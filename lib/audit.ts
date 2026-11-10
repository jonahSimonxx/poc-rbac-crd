// ============================================================
//  Registro de auditoria desde la aplicacion
//
//  La base garantiza la inmutabilidad y el encadenamiento por
//  hash (ADR-001 D10). Aqui solo se arma e inserta la entrada.
// ============================================================

import { pool } from './db.ts';
import type { Sesion } from './auth.ts';
import { can } from '../src/core/policy.ts';
import { construirEntrada } from '../src/core/auditoria.ts';
import type { Permiso } from '../src/core/catalog.ts';
import type { Decision, RecursoRef } from '../src/core/types.ts';

/** Lo cumplen tanto el pool como un cliente dentro de una transaccion. */
export interface Ejecutor {
  query(texto: string, valores?: unknown[]): Promise<unknown>;
}

export async function auditar(
  sesion: Sesion,
  permiso: Permiso,
  recurso: RecursoRef,
  detalle: Record<string, unknown> = {},
  decision?: Decision,
  ejecutor: Ejecutor = pool,
): Promise<Decision> {
  const d = decision ?? can(sesion.sujeto, permiso, recurso);
  const entrada = construirEntrada(sesion.sujeto, permiso, recurso, d, detalle);

  await ejecutor.query(
    `INSERT INTO auditoria
       (usuario_id, rol_codigo, estudio_id, entidad, entidad_id, accion, resultado, detalle)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      entrada.usuarioId,
      entrada.rolCodigo,
      entrada.estudioId,
      entrada.entidad,
      entrada.entidadId,
      entrada.accion,
      entrada.resultado,
      JSON.stringify(entrada.detalle),
    ],
  );

  return d;
}

/** Solo cuando no hay usuario autenticado (por ejemplo, login fallido). */
export async function auditarAnonimo(
  entidad: string,
  entidadId: string,
  accion: string,
  detalle: Record<string, unknown> = {},
): Promise<void> {
  await pool.query(
    `INSERT INTO auditoria
       (usuario_id, rol_codigo, estudio_id, entidad, entidad_id, accion, resultado, detalle)
     VALUES (NULL, NULL, NULL, $1, $2, $3, 'denegado', $4::jsonb)`,
    [entidad, entidadId, accion, JSON.stringify(detalle)],
  );
}
