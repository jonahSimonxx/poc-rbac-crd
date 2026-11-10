// ============================================================
//  Consultas de lectura para las pantallas
//
//  Todas reciben la sesion y aplican el ambito por estudio.
//  Ninguna decision de acceso se toma aqui: los permisos se
//  comprueban antes, en la pagina o en la accion.
// ============================================================

import { pool } from './db.ts';
import type { Sesion } from './auth.ts';
import { esGlobal, estudiosPermitidos } from './guard.ts';

export interface EstudioResumen {
  id: string;
  codigo: string;
  nombre: string;
  patrocinador: string | null;
  estado: string;
  sitios: number;
  pacientes: number;
  asignaciones: number;
}

export async function estudiosDe(sesion: Sesion): Promise<EstudioResumen[]> {
  const global = esGlobal(sesion);
  const ids = estudiosPermitidos(sesion);

  const { rows } = await pool.query(
    `SELECT e.id, e.codigo, e.nombre, e.patrocinador, e.estado,
            (SELECT count(*)::int FROM sitio s WHERE s.estudio_id = e.id) AS sitios,
            (SELECT count(*)::int FROM paciente p
              WHERE p.estudio_id = e.id AND NOT p.anulado) AS pacientes,
            (SELECT count(*)::int FROM asignacion a
              WHERE a.estudio_id = e.id AND a.activa) AS asignaciones
     FROM estudio e
     WHERE $1::boolean OR e.id = ANY($2::uuid[])
     ORDER BY e.codigo`,
    [global, ids],
  );

  return rows;
}

export interface ResumenClinico {
  pacientes: number;
  anulados: number;
  crd_firmados: number;
  crd_borrador: number;
  eventos: number;
  dosis: number;
}

export async function resumenClinico(sesion: Sesion): Promise<ResumenClinico> {
  const ids = estudiosPermitidos(sesion);

  const { rows } = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM paciente p
         WHERE p.estudio_id = ANY($1::uuid[]) AND NOT p.anulado) AS pacientes,
       (SELECT count(*)::int FROM paciente p
         WHERE p.estudio_id = ANY($1::uuid[]) AND p.anulado) AS anulados,
       (SELECT count(*)::int FROM crd c
         JOIN paciente p ON p.id = c.paciente_id
         WHERE p.estudio_id = ANY($1::uuid[]) AND c.estado = 'firmado') AS crd_firmados,
       (SELECT count(*)::int FROM crd c
         JOIN paciente p ON p.id = c.paciente_id
         WHERE p.estudio_id = ANY($1::uuid[]) AND c.estado = 'borrador') AS crd_borrador,
       (SELECT count(*)::int FROM evento_adverso ev
         JOIN paciente p ON p.id = ev.paciente_id
         WHERE p.estudio_id = ANY($1::uuid[])) AS eventos,
       (SELECT count(*)::int FROM dosis d
         JOIN paciente p ON p.id = d.paciente_id
         WHERE p.estudio_id = ANY($1::uuid[])) AS dosis`,
    [ids],
  );

  return rows[0];
}

export async function resumenAdmin(): Promise<{
  usuarios: number;
  estudios: number;
  asignaciones: number;
  auditoria: number;
}> {
  const { rows } = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM usuario WHERE activo) AS usuarios,
       (SELECT count(*)::int FROM estudio) AS estudios,
       (SELECT count(*)::int FROM asignacion WHERE activa) AS asignaciones,
       (SELECT count(*)::int FROM auditoria) AS auditoria`,
  );
  return rows[0];
}

export async function verificarCadena(): Promise<{
  total: number;
  integra: boolean;
  primerError: number | null;
}> {
  const { rows } = await pool.query(
    `SELECT total, integra, primer_error FROM verificar_auditoria()`,
  );
  const r = rows[0];
  return {
    total: Number(r.total),
    integra: Boolean(r.integra),
    primerError: r.primer_error === null ? null : Number(r.primer_error),
  };
}

export interface FiltroPacientes {
  estudio?: string;
  sitio?: string;
  q?: string;
  estado?: string;
}

export async function pacientesDe(sesion: Sesion, filtro: FiltroPacientes) {
  const ids = estudiosPermitidos(sesion);
  const condiciones: string[] = ['p.estudio_id = ANY($1::uuid[])'];
  const args: unknown[] = [ids];

  if (filtro.estudio) {
    args.push(filtro.estudio);
    condiciones.push(`p.estudio_id = $${args.length}`);
  }
  if (filtro.sitio) {
    args.push(filtro.sitio);
    condiciones.push(`p.sitio_id = $${args.length}`);
  }
  if (filtro.q) {
    args.push(`%${filtro.q.trim()}%`);
    condiciones.push(
      `(p.codigo ILIKE $${args.length} OR p.iniciales ILIKE $${args.length} OR i.nombre ILIKE $${args.length})`,
    );
  }
  if (filtro.estado === 'anulado') condiciones.push('p.anulado');
  if (filtro.estado === 'activo') condiciones.push('NOT p.anulado');

  const { rows } = await pool.query(
    `SELECT p.id, p.codigo, p.iniciales, p.edad, p.sexo, p.anulado, p.creado_en,
            e.codigo AS estudio, s.codigo AS sitio, i.nombre AS nombre,
            (SELECT count(*)::int FROM crd c WHERE c.paciente_id = p.id) AS crd_total,
            (SELECT count(*)::int FROM crd c
              WHERE c.paciente_id = p.id AND c.estado = 'firmado') AS crd_firmados,
            (SELECT count(*)::int FROM evento_adverso ev
              WHERE ev.paciente_id = p.id) AS eventos
     FROM paciente p
     JOIN estudio e ON e.id = p.estudio_id
     JOIN sitio s ON s.id = p.sitio_id
     LEFT JOIN identidad_paciente i ON i.paciente_id = p.id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY e.codigo, p.codigo
     LIMIT 300`,
    args,
  );

  return rows;
}

export async function pacienteDetalle(id: string) {
  const pacienteQ = await pool.query(
    `SELECT p.*, e.codigo AS estudio, e.nombre AS estudio_nombre,
            s.codigo AS sitio, s.nombre AS sitio_nombre
     FROM paciente p
     JOIN estudio e ON e.id = p.estudio_id
     JOIN sitio s ON s.id = p.sitio_id
     WHERE p.id = $1`,
    [id],
  );

  const paciente = pacienteQ.rows[0];
  if (!paciente) return null;

  const [identidadQ, crdQ, dosisQ, eventosQ] = await Promise.all([
    pool.query(`SELECT * FROM identidad_paciente WHERE paciente_id = $1`, [id]),
    pool.query(
      `SELECT c.*, u.nombre AS firmado_por_nombre
       FROM crd c
       LEFT JOIN usuario u ON u.id = c.firmado_por
       WHERE c.paciente_id = $1
       ORDER BY c.tipo, c.visita`,
      [id],
    ),
    pool.query(`SELECT * FROM dosis WHERE paciente_id = $1 ORDER BY numero_toma`, [id]),
    pool.query(
      `SELECT ev.*, u.nombre AS creado_por_nombre
       FROM evento_adverso ev
       LEFT JOIN usuario u ON u.id = ev.creado_por
       WHERE ev.paciente_id = $1
       ORDER BY ev.fecha_inicio DESC NULLS LAST, ev.creado_en DESC`,
      [id],
    ),
  ]);

  return {
    paciente,
    identidad: identidadQ.rows[0] ?? null,
    crds: crdQ.rows,
    dosis: dosisQ.rows,
    eventos: eventosQ.rows,
  };
}

export async function auditoriaDePaciente(pacienteId: string, limite = 30) {
  const { rows } = await pool.query(
    `SELECT a.*, u.nombre AS usuario_nombre
     FROM auditoria a
     LEFT JOIN usuario u ON u.id = a.usuario_id
     WHERE (a.entidad = 'paciente' AND a.entidad_id = $1)
        OR (a.detalle->>'paciente_id' = $1)
     ORDER BY a.id DESC
     LIMIT $2`,
    [pacienteId, limite],
  );
  return rows;
}

export async function sitiosDe(estudioIds: string[]) {
  const { rows } = await pool.query(
    `SELECT s.id, s.codigo, s.nombre, s.activo, e.codigo AS estudio, e.id AS estudio_id,
            (SELECT count(*)::int FROM paciente p
              WHERE p.sitio_id = s.id AND NOT p.anulado) AS pacientes
     FROM sitio s
     JOIN estudio e ON e.id = s.estudio_id
     WHERE s.estudio_id = ANY($1::uuid[])
     ORDER BY e.codigo, s.codigo`,
    [estudioIds],
  );
  return rows;
}

export async function usuariosAdmin() {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.nombre, u.activo, u.creado_en,
            COALESCE(
              json_agg(json_build_object('rol', a.rol_codigo, 'estudio', e.codigo))
              FILTER (WHERE a.id IS NOT NULL),
              '[]'
            ) AS asignaciones
     FROM usuario u
     LEFT JOIN asignacion a ON a.usuario_id = u.id AND a.activa
     LEFT JOIN estudio e ON e.id = a.estudio_id
     GROUP BY u.id
     ORDER BY u.activo DESC, u.nombre`,
  );
  return rows;
}

export async function asignacionesDe(sesion: Sesion) {
  const global = esGlobal(sesion);
  const ids = estudiosPermitidos(sesion);

  const { rows } = await pool.query(
    `SELECT a.id, a.activa, a.creada_en, a.baja_en, a.rol_codigo,
            u.id AS usuario_id, u.nombre, u.email,
            e.id AS estudio_id, e.codigo AS estudio
     FROM asignacion a
     JOIN usuario u ON u.id = a.usuario_id
     LEFT JOIN estudio e ON e.id = a.estudio_id
     WHERE $1::boolean OR e.id = ANY($2::uuid[])
     ORDER BY a.activa DESC, e.codigo NULLS FIRST, u.nombre`,
    [global, ids],
  );
  return rows;
}

export async function usuariosParaAsignar() {
  const { rows } = await pool.query(
    `SELECT id, nombre, email FROM usuario WHERE activo ORDER BY nombre`,
  );
  return rows;
}

export async function estudiosParaFormulario(sesion: Sesion) {
  const global = esGlobal(sesion);
  const ids = estudiosPermitidos(sesion);

  const { rows } = await pool.query(
    `SELECT e.id, e.codigo, e.nombre,
            (SELECT COALESCE(json_agg(json_build_object('id', s.id, 'codigo', s.codigo, 'nombre', s.nombre)
                    ORDER BY s.codigo), '[]')
             FROM sitio s WHERE s.estudio_id = e.id AND s.activo) AS sitios
     FROM estudio e
     WHERE e.estado = 'activo' AND ($1::boolean OR e.id = ANY($2::uuid[]))
     ORDER BY e.codigo`,
    [global, ids],
  );
  return rows;
}

const ENTIDADES_ADMIN = ['usuario', 'asignacion', 'sesion', 'estudio', 'auditoria'];

export interface FiltroAuditoria {
  entidad?: string;
  resultado?: string;
  estudio?: string;
  q?: string;
}

export async function auditoriaDe(
  sesion: Sesion,
  limite = 120,
  filtro: FiltroAuditoria = {},
) {
  const global = esGlobal(sesion);
  const ids = estudiosPermitidos(sesion);

  const condiciones: string[] = [];
  const args: unknown[] = [];

  if (global) {
    // El administrador solo ve la auditoría administrativa, nunca la clínica.
    args.push(ENTIDADES_ADMIN);
    condiciones.push(`a.entidad = ANY($${args.length}::text[])`);
  } else {
    // El ámbito lo define la asignación: solo estudios del usuario.
    args.push(ids);
    condiciones.push(`a.estudio_id = ANY($${args.length}::uuid[])`);
  }

  if (filtro.entidad) {
    args.push(filtro.entidad);
    condiciones.push(`a.entidad = $${args.length}`);
  }
  if (filtro.resultado === 'permitido' || filtro.resultado === 'denegado') {
    args.push(filtro.resultado);
    condiciones.push(`a.resultado = $${args.length}`);
  }
  if (filtro.estudio && !global) {
    args.push(filtro.estudio);
    condiciones.push(`a.estudio_id = $${args.length}`);
  }
  if (filtro.q) {
    args.push(`%${filtro.q.trim()}%`);
    condiciones.push(
      `(a.entidad_id ILIKE $${args.length} OR a.accion ILIKE $${args.length} OR u.nombre ILIKE $${args.length})`,
    );
  }

  args.push(limite);

  const { rows } = await pool.query(
    `SELECT a.*, u.nombre AS usuario_nombre, e.codigo AS estudio_codigo
     FROM auditoria a
     LEFT JOIN usuario u ON u.id = a.usuario_id
     LEFT JOIN estudio e ON e.id = a.estudio_id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY a.id DESC
     LIMIT $${args.length}`,
    args,
  );
  return rows;
}

export async function resumenAuditoria(sesion: Sesion) {
  const global = esGlobal(sesion);
  const ids = estudiosPermitidos(sesion);

  const { rows } = await pool.query(
    `SELECT
       count(*)::int AS total,
       count(*) FILTER (WHERE a.resultado = 'denegado')::int AS denegados,
       count(*) FILTER (WHERE a.resultado = 'permitido')::int AS permitidos,
       max(a.fecha) AS ultimo
     FROM auditoria a
     WHERE ($1::boolean AND a.entidad = ANY($3::text[]))
        OR (NOT $1::boolean AND a.estudio_id = ANY($2::uuid[]))`,
    [global, ids, ENTIDADES_ADMIN],
  );
  return rows[0];
}

export async function avancePorEstudio(sesion: Sesion) {
  const global = esGlobal(sesion);
  const ids = estudiosPermitidos(sesion);

  const { rows } = await pool.query(
    `SELECT e.codigo, e.nombre, e.estado,
            count(DISTINCT p.id) FILTER (WHERE NOT p.anulado)::int AS pacientes,
            count(c.id) FILTER (WHERE c.estado = 'firmado')::int AS firmados,
            count(c.id) FILTER (WHERE c.estado = 'borrador')::int AS borradores,
            (SELECT count(*)::int FROM sitio s WHERE s.estudio_id = e.id) AS sitios
     FROM estudio e
     LEFT JOIN paciente p ON p.estudio_id = e.id
     LEFT JOIN crd c ON c.paciente_id = p.id
     WHERE $1::boolean OR e.id = ANY($2::uuid[])
     GROUP BY e.id
     ORDER BY e.codigo`,
    [global, ids],
  );
  return rows;
}

export async function eventosRecientes(sesion: Sesion, limite = 6) {
  const ids = estudiosPermitidos(sesion);

  const { rows } = await pool.query(
    `SELECT ev.id, ev.descripcion, ev.gravedad, ev.causalidad, ev.desenlace,
            ev.fecha_inicio, ev.fecha_fin,
            p.codigo AS paciente, p.id AS paciente_id, e.codigo AS estudio
     FROM evento_adverso ev
     JOIN paciente p ON p.id = ev.paciente_id
     JOIN estudio e ON e.id = p.estudio_id
     WHERE p.estudio_id = ANY($1::uuid[])
     ORDER BY ev.creado_en DESC
     LIMIT $2`,
    [ids, limite],
  );
  return rows;
}

export async function crdPendientes(sesion: Sesion, limite = 6) {
  const ids = estudiosPermitidos(sesion);

  const { rows } = await pool.query(
    `SELECT c.id, c.tipo, c.visita, c.estado, c.creado_en,
            p.id AS paciente_id, p.codigo AS paciente, e.codigo AS estudio
     FROM crd c
     JOIN paciente p ON p.id = c.paciente_id
     JOIN estudio e ON e.id = p.estudio_id
     WHERE p.estudio_id = ANY($1::uuid[]) AND c.estado = 'borrador'
     ORDER BY c.creado_en ASC
     LIMIT $2`,
    [ids, limite],
  );
  return rows;
}
