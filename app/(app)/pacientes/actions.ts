'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { pool } from '@/lib/db';
import { requireSesion, decidir } from '@/lib/guard';
import { auditar } from '@/lib/audit';

const TIPOS_CRD = [
  'inclusion',
  'evaluacion_inicial',
  'evaluacion_intermedia',
  'evaluacion_final',
  'examen_fisico',
  'laboratorio',
  'tratamiento_concomitante',
  'fallecimiento',
  'interrupcion',
  'imagenes',
] as const;

type TipoCrd = (typeof TIPOS_CRD)[number];

function mensaje(base: string, clave: 'error' | 'ok', texto: string): string {
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${clave}=${encodeURIComponent(texto)}`;
}

async function estudioDePaciente(pacienteId: string): Promise<string | null> {
  const { rows } = await pool.query(`SELECT estudio_id FROM paciente WHERE id = $1`, [pacienteId]);
  return rows[0]?.estudio_id ?? null;
}

async function contextoDeCrd(crdId: string) {
  const { rows } = await pool.query(
    `SELECT c.id, c.estado, c.tipo, c.visita,
            p.id AS paciente_id, p.codigo AS paciente_codigo, p.estudio_id
     FROM crd c
     JOIN paciente p ON p.id = c.paciente_id
     WHERE c.id = $1`,
    [crdId],
  );
  return rows[0] ?? null;
}

// ------------------------------------------------------------
//  Crear paciente (datos clínicos + identidad en una transacción)
// ------------------------------------------------------------
export async function crearPaciente(formData: FormData): Promise<void> {
  const sesion = await requireSesion();
  const volver = '/pacientes/nuevo';
  const error = (texto: string): never => redirect(mensaje(volver, 'error', texto));

  const estudioId = String(formData.get('estudioId') ?? '');
  const sitioId = String(formData.get('sitioId') ?? '');
  const codigo = String(formData.get('codigo') ?? '').trim();
  const iniciales = String(formData.get('iniciales') ?? '').trim().toUpperCase();
  const edad = Number(formData.get('edad'));
  const sexo = String(formData.get('sexo') ?? '');
  const colorPiel = String(formData.get('colorPiel') ?? '').trim();
  const pesoTexto = String(formData.get('peso') ?? '').trim();
  const peso = pesoTexto ? Number(pesoTexto) : null;
  const antecedentes = String(formData.get('antecedentes') ?? '').trim();
  const diagnostico = String(formData.get('diagnostico') ?? '').trim();

  const nombre = String(formData.get('nombre') ?? '').trim();
  const documento = String(formData.get('documento') ?? '').trim();
  const telefono = String(formData.get('telefono') ?? '').trim();
  const consentimiento = formData.get('consentimiento') === 'on';

  if (!estudioId || !sitioId || !codigo || !iniciales || !nombre || !documento) {
    error('Completa estudio, sitio, código, iniciales, nombre y documento.');
  }
  if (!Number.isInteger(edad) || edad < 0 || edad > 120) {
    error('La edad debe ser un número entero entre 0 y 120.');
  }
  if (sexo !== 'M' && sexo !== 'F') error('Selecciona el sexo.');
  if (peso !== null && (!Number.isFinite(peso) || peso <= 0)) {
    error('El peso debe ser mayor que cero.');
  }

  const dPaciente = decidir(sesion, 'paciente:create', { tipo: 'paciente', estudioId });
  const dIdentidad = decidir(sesion, 'identidad:create', { tipo: 'identidad', estudioId });

  if (!dPaciente.permitido || !dIdentidad.permitido) {
    await auditar(
      sesion,
      'paciente:create',
      { tipo: 'paciente', estudioId },
      { codigo, motivo: 'alta de paciente rechazada' },
      dPaciente,
    );
    redirect(mensaje('/pacientes', 'error', 'No tienes permiso para crear pacientes en ese estudio.'));
  }

  const sitio = await pool.query(
    `SELECT 1 FROM sitio WHERE id = $1 AND estudio_id = $2`,
    [sitioId, estudioId],
  );
  if (sitio.rowCount !== 1) error('El sitio seleccionado no pertenece al estudio.');

  const cliente = await pool.connect();
  let nuevoId: string | null = null;

  try {
    await cliente.query('BEGIN');

    const q = await cliente.query(
      `INSERT INTO paciente
         (estudio_id, sitio_id, codigo, iniciales, edad, sexo, color_piel,
          peso_kg, antecedentes, diagnostico, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        estudioId,
        sitioId,
        codigo,
        iniciales,
        edad,
        sexo,
        colorPiel || null,
        peso,
        antecedentes || null,
        diagnostico || null,
        sesion.usuario.id,
      ],
    );

    const idPaciente: string = q.rows[0].id;
    nuevoId = idPaciente;

    await cliente.query(
      `INSERT INTO identidad_paciente
         (paciente_id, nombre, documento, telefono, consentimiento_firmado, consentimiento_fecha)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        idPaciente,
        nombre,
        documento,
        telefono || null,
        consentimiento,
        consentimiento ? new Date().toISOString().slice(0, 10) : null,
      ],
    );

    await auditar(
      sesion,
      'paciente:create',
      { tipo: 'paciente', id: idPaciente, estudioId },
      { codigo, identidad: true, consentimiento },
      undefined,
      cliente,
    );

    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK');
    if ((e as { code?: string }).code === '23505') {
      error('Ya existe un paciente con ese código en el estudio.');
    }
    throw e;
  } finally {
    cliente.release();
  }

  if (nuevoId) {
    revalidatePath('/pacientes');
    redirect(mensaje(`/pacientes/${nuevoId}`, 'ok', 'Paciente creado correctamente.'));
  }
}

// ------------------------------------------------------------
//  Anular paciente (sin borrado: exige motivo)
// ------------------------------------------------------------
export async function anularPaciente(formData: FormData): Promise<void> {
  const sesion = await requireSesion();
  const pacienteId = String(formData.get('pacienteId') ?? '');
  const motivo = String(formData.get('motivo') ?? '').trim();
  const volver = `/pacientes/${pacienteId}`;

  if (!motivo) redirect(mensaje(volver, 'error', 'El motivo de anulación es obligatorio.'));

  const estudioId = await estudioDePaciente(pacienteId);
  if (!estudioId) redirect(mensaje('/pacientes', 'error', 'Paciente no encontrado.'));

  const recurso = { tipo: 'paciente' as const, id: pacienteId, estudioId };
  const decision = decidir(sesion, 'paciente:annul', recurso);

  if (!decision.permitido) {
    await auditar(sesion, 'paciente:annul', recurso, { motivo: 'anulación rechazada' }, decision);
    redirect(mensaje(volver, 'error', 'No tienes permiso para anular este paciente.'));
  }

  const q = await pool.query(
    `UPDATE paciente
     SET anulado = true, motivo_anulacion = $2
     WHERE id = $1 AND NOT anulado`,
    [pacienteId, motivo],
  );

  if (q.rowCount === 0) {
    redirect(mensaje(volver, 'error', 'El paciente ya estaba anulado.'));
  }

  await auditar(sesion, 'paciente:annul', recurso, { motivo });
  revalidatePath(`/pacientes/${pacienteId}`);
  revalidatePath('/pacientes');
  redirect(mensaje(volver, 'ok', 'Paciente anulado. El registro se conserva.'));
}

// ------------------------------------------------------------
//  CRD: crear, firmar y anular
// ------------------------------------------------------------
export async function crearCrd(formData: FormData): Promise<void> {
  const sesion = await requireSesion();
  const pacienteId = String(formData.get('pacienteId') ?? '');
  const tipo = String(formData.get('tipo') ?? '');
  const visita = Number(formData.get('visita') ?? 1);
  const volver = `/pacientes/${pacienteId}`;

  if (!TIPOS_CRD.includes(tipo as TipoCrd)) {
    redirect(mensaje(volver, 'error', 'Tipo de formulario no válido.'));
  }
  if (!Number.isInteger(visita) || visita < 1) {
    redirect(mensaje(volver, 'error', 'La visita debe ser un entero mayor o igual a 1.'));
  }

  const estudioId = await estudioDePaciente(pacienteId);
  if (!estudioId) redirect(mensaje('/pacientes', 'error', 'Paciente no encontrado.'));

  const recurso = { tipo: 'crd' as const, id: pacienteId, estudioId };
  const decision = decidir(sesion, 'crd:create', recurso);

  if (!decision.permitido) {
    await auditar(sesion, 'crd:create', recurso, { tipo, visita }, decision);
    redirect(mensaje(volver, 'error', 'No tienes permiso para crear formularios en este estudio.'));
  }

  try {
    const q = await pool.query(
      `INSERT INTO crd (paciente_id, tipo, visita, datos, estado, creado_por)
       VALUES ($1, $2, $3, '{}'::jsonb, 'borrador', $4)
       RETURNING id`,
      [pacienteId, tipo, visita, sesion.usuario.id],
    );

    await auditar(
      sesion,
      'crd:create',
      { tipo: 'crd', id: q.rows[0].id, estudioId },
      { paciente_id: pacienteId, tipo, visita },
    );
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      redirect(mensaje(volver, 'error', 'Ya existe ese formulario para esa visita.'));
    }
    throw e;
  }

  revalidatePath(volver);
  redirect(mensaje(volver, 'ok', 'Formulario creado en borrador.'));
}

export async function firmarCrd(formData: FormData): Promise<void> {
  const sesion = await requireSesion();
  const crdId = String(formData.get('crdId') ?? '');
  const ctx = await contextoDeCrd(crdId);
  const volver = ctx ? `/pacientes/${ctx.paciente_id}` : '/pacientes';

  if (!ctx) redirect(mensaje('/pacientes', 'error', 'Formulario no encontrado.'));

  const recurso = { tipo: 'crd' as const, id: crdId, estudioId: ctx.estudio_id };
  const decision = decidir(sesion, 'crd:sign', recurso);

  if (!decision.permitido) {
    await auditar(sesion, 'crd:sign', recurso, { paciente_id: ctx.paciente_id }, decision);
    redirect(mensaje(volver, 'error', 'No tienes permiso para firmar este formulario.'));
  }

  const q = await pool.query(
    `UPDATE crd
     SET estado = 'firmado', firmado_por = $2, firmado_en = now()
     WHERE id = $1 AND estado = 'borrador'`,
    [crdId, sesion.usuario.id],
  );

  if (q.rowCount === 0) {
    redirect(mensaje(volver, 'error', 'El formulario no está en borrador.'));
  }

  await auditar(
    sesion,
    'crd:sign',
    recurso,
    { paciente_id: ctx.paciente_id, tipo: ctx.tipo, visita: ctx.visita },
  );

  revalidatePath(volver);
  redirect(mensaje(volver, 'ok', 'Formulario firmado.'));
}

export async function anularCrd(formData: FormData): Promise<void> {
  const sesion = await requireSesion();
  const crdId = String(formData.get('crdId') ?? '');
  const motivo = String(formData.get('motivo') ?? '').trim();
  const ctx = await contextoDeCrd(crdId);

  if (!ctx) redirect(mensaje('/pacientes', 'error', 'Formulario no encontrado.'));

  const volver = `/pacientes/${ctx.paciente_id}`;
  if (!motivo) redirect(mensaje(volver, 'error', 'El motivo de anulación es obligatorio.'));

  const recurso = { tipo: 'crd' as const, id: crdId, estudioId: ctx.estudio_id };
  const decision = decidir(sesion, 'crd:annul', recurso);

  if (!decision.permitido) {
    await auditar(sesion, 'crd:annul', recurso, { paciente_id: ctx.paciente_id }, decision);
    redirect(mensaje(volver, 'error', 'No tienes permiso para anular este formulario.'));
  }

  await pool.query(
    `UPDATE crd
     SET estado = 'anulado',
         datos = datos || jsonb_build_object('motivo_anulacion', $2::text)
     WHERE id = $1 AND estado <> 'anulado'`,
    [crdId, motivo],
  );

  await auditar(
    sesion,
    'crd:annul',
    recurso,
    { paciente_id: ctx.paciente_id, tipo: ctx.tipo, visita: ctx.visita, motivo },
  );

  revalidatePath(volver);
  redirect(mensaje(volver, 'ok', 'Formulario anulado. El registro se conserva.'));
}

// ------------------------------------------------------------
//  Eventos adversos
// ------------------------------------------------------------
export async function crearEvento(formData: FormData): Promise<void> {
  const sesion = await requireSesion();
  const pacienteId = String(formData.get('pacienteId') ?? '');
  const descripcion = String(formData.get('descripcion') ?? '').trim();
  const gravedad = String(formData.get('gravedad') ?? '');
  const causalidad = String(formData.get('causalidad') ?? '') || null;
  const desenlace = String(formData.get('desenlace') ?? '').trim() || null;
  const fechaInicio = String(formData.get('fechaInicio') ?? '') || null;
  const fechaFin = String(formData.get('fechaFin') ?? '') || null;
  const volver = `/pacientes/${pacienteId}`;

  if (!descripcion) redirect(mensaje(volver, 'error', 'Describe el evento adverso.'));
  if (!['leve', 'moderada', 'grave'].includes(gravedad)) {
    redirect(mensaje(volver, 'error', 'Selecciona la gravedad.'));
  }

  const estudioId = await estudioDePaciente(pacienteId);
  if (!estudioId) redirect(mensaje('/pacientes', 'error', 'Paciente no encontrado.'));

  const recurso = { tipo: 'evento' as const, id: pacienteId, estudioId };
  const decision = decidir(sesion, 'evento:create', recurso);

  if (!decision.permitido) {
    await auditar(sesion, 'evento:create', recurso, { descripcion }, decision);
    redirect(mensaje(volver, 'error', 'No tienes permiso para documentar eventos.'));
  }

  const q = await pool.query(
    `INSERT INTO evento_adverso
       (paciente_id, descripcion, gravedad, causalidad, desenlace, fecha_inicio, fecha_fin, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [pacienteId, descripcion, gravedad, causalidad, desenlace, fechaInicio, fechaFin, sesion.usuario.id],
  );

  await auditar(
    sesion,
    'evento:create',
    { tipo: 'evento', id: q.rows[0].id, estudioId },
    { paciente_id: pacienteId, gravedad },
  );

  revalidatePath(volver);
  redirect(mensaje(volver, 'ok', 'Evento adverso registrado.'));
}

// ------------------------------------------------------------
//  Dosis
// ------------------------------------------------------------
export async function crearDosis(formData: FormData): Promise<void> {
  const sesion = await requireSesion();
  const pacienteId = String(formData.get('pacienteId') ?? '');
  const numeroToma = Number(formData.get('numeroToma'));
  const lote = String(formData.get('lote') ?? '').trim() || null;
  const dosisMg = Number(formData.get('dosisMg'));
  const via = String(formData.get('via') ?? '').trim();
  const fechaHora = String(formData.get('fechaHora') ?? '') || null;
  const volver = `/pacientes/${pacienteId}`;

  if (!Number.isInteger(numeroToma) || numeroToma < 1) {
    redirect(mensaje(volver, 'error', 'El número de toma debe ser un entero positivo.'));
  }
  if (!Number.isFinite(dosisMg) || dosisMg <= 0) {
    redirect(mensaje(volver, 'error', 'La dosis debe ser mayor que cero.'));
  }
  if (!via) redirect(mensaje(volver, 'error', 'Indica la vía de administración.'));

  const estudioId = await estudioDePaciente(pacienteId);
  if (!estudioId) redirect(mensaje('/pacientes', 'error', 'Paciente no encontrado.'));

  const recurso = { tipo: 'dosis' as const, id: pacienteId, estudioId };
  const decision = decidir(sesion, 'dosis:create', recurso);

  if (!decision.permitido) {
    await auditar(sesion, 'dosis:create', recurso, { numeroToma }, decision);
    redirect(mensaje(volver, 'error', 'No tienes permiso para registrar dosis.'));
  }

  try {
    const q = await pool.query(
      `INSERT INTO dosis
         (paciente_id, numero_toma, lote, dosis_mg, via, fecha_hora, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [pacienteId, numeroToma, lote, dosisMg, via, fechaHora, sesion.usuario.id],
    );

    await auditar(
      sesion,
      'dosis:create',
      { tipo: 'dosis', id: q.rows[0].id, estudioId },
      { paciente_id: pacienteId, numeroToma },
    );
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      redirect(mensaje(volver, 'error', 'Ese número de toma ya existe para el paciente.'));
    }
    throw e;
  }

  revalidatePath(volver);
  redirect(mensaje(volver, 'ok', 'Dosis registrada.'));
}
