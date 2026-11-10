'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { pool } from '@/lib/db';
import { requireSesion, decidir, esGlobal } from '@/lib/guard';
import { auditar } from '@/lib/audit';

const ROLES_ASIGNABLES = ['jefe-estudio', 'medico-investigador'];

function mensaje(base: string, clave: 'error' | 'ok', texto: string): string {
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${clave}=${encodeURIComponent(texto)}`;
}

export async function crearAsignacion(formData: FormData): Promise<void> {
  const sesion = await requireSesion();
  const volver = '/asignaciones';

  const usuarioId = String(formData.get('usuarioId') ?? '');
  const estudioId = String(formData.get('estudioId') ?? '');
  const rol = String(formData.get('rol') ?? '');

  const error = (texto: string): never => redirect(mensaje(volver, 'error', texto));

  if (!usuarioId || !estudioId || !rol) error('Selecciona usuario, estudio y rol.');
  if (!ROLES_ASIGNABLES.includes(rol)) error('Rol no asignable.');
  if (usuarioId === sesion.usuario.id) {
    error('Nadie puede asignarse a sí mismo. Otro administrador debe confirmar la asignación.');
  }

  const global = esGlobal(sesion);
  if (!global && rol !== 'medico-investigador') {
    error('El jefe de estudio solo puede asignar médicos investigadores.');
  }

  const recurso = { tipo: 'asignacion' as const, estudioId };
  const decision = decidir(sesion, 'asignacion:create', recurso);

  if (!decision.permitido) {
    await auditar(sesion, 'asignacion:create', recurso, { usuarioId, rol }, decision);
    redirect(mensaje(volver, 'error', 'No tienes permiso para asignar usuarios a ese estudio.'));
  }

  const usuario = await pool.query(`SELECT activo FROM usuario WHERE id = $1`, [usuarioId]);
  if (!usuario.rows[0]?.activo) error('El usuario no existe o está inactivo.');

  try {
    const q = await pool.query(
      `INSERT INTO asignacion (usuario_id, estudio_id, rol_codigo, activa, creada_por)
       VALUES ($1, $2, $3, true, $4)
       RETURNING id`,
      [usuarioId, estudioId, rol, sesion.usuario.id],
    );

    await auditar(
      sesion,
      'asignacion:create',
      { tipo: 'asignacion', id: q.rows[0].id, estudioId },
      { usuario_id: usuarioId, rol },
      decision,
    );
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      error('Ese usuario ya tiene una asignación activa en el estudio. Revócala antes de cambiarla.');
    }
    throw e;
  }

  revalidatePath('/asignaciones');
  redirect(mensaje(volver, 'ok', 'Asignación creada.'));
}

export async function revocarAsignacion(formData: FormData): Promise<void> {
  const sesion = await requireSesion();
  const asignacionId = String(formData.get('asignacionId') ?? '');
  const volver = '/asignaciones';

  if (!asignacionId) redirect(mensaje(volver, 'error', 'Asignación no válida.'));

  const { rows } = await pool.query(
    `SELECT id, usuario_id, estudio_id, rol_codigo, activa
     FROM asignacion WHERE id = $1`,
    [asignacionId],
  );

  const a = rows[0];
  if (!a) redirect(mensaje(volver, 'error', 'Asignación no encontrada.'));
  if (!a.activa) redirect(mensaje(volver, 'error', 'La asignación ya está dada de baja.'));

  if (a.usuario_id === sesion.usuario.id) {
    redirect(
      mensaje(volver, 'error', 'No puedes revocar tu propia asignación. Debe hacerlo otro usuario.'),
    );
  }

  if (!esGlobal(sesion) && a.rol_codigo !== 'medico-investigador') {
    redirect(mensaje(volver, 'error', 'El jefe de estudio solo gestiona médicos investigadores.'));
  }

  const recurso = { tipo: 'asignacion' as const, id: asignacionId, estudioId: a.estudio_id };
  const decision = decidir(sesion, 'asignacion:revoke', recurso);

  if (!decision.permitido) {
    await auditar(sesion, 'asignacion:revoke', recurso, {}, decision);
    redirect(mensaje(volver, 'error', 'No tienes permiso para revocar esa asignación.'));
  }

  await pool.query(
    `UPDATE asignacion SET activa = false, baja_en = now() WHERE id = $1 AND activa`,
    [asignacionId],
  );

  await auditar(sesion, 'asignacion:revoke', recurso, { rol: a.rol_codigo }, decision);

  revalidatePath('/asignaciones');
  redirect(mensaje(volver, 'ok', 'Asignación revocada. El acceso cesa de inmediato.'));
}
