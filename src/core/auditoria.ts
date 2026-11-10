// ============================================================
//  Construccion de entradas de auditoria
//
//  Este modulo no escribe en la base: arma el registro que luego
//  se inserta en la tabla `auditoria`. La inmutabilidad y el
//  encadenamiento por hash viven en PostgreSQL (ADR-001 D10).
// ============================================================

import type { Permiso, RolCodigo } from './catalog.ts';
import type { Decision, Motivo, RecursoRef, Sujeto } from './types.ts';

export interface EntradaAuditoria {
  readonly usuarioId: string;
  readonly rolCodigo: RolCodigo | null;
  readonly estudioId: string | null;
  readonly entidad: string;
  readonly entidadId: string;
  readonly accion: string;
  readonly resultado: 'permitido' | 'denegado';
  readonly detalle: Record<string, unknown>;
}

export const MOTIVOS: Record<Motivo, string> = {
  ok: 'Permitido',
  usuario_inactivo: 'El usuario esta inactivo',
  sin_asignacion: 'El usuario no tiene asignaciones activas',
  permiso_no_otorgado: 'Ninguno de sus roles concede esta accion',
  fuera_de_ambito: 'La accion pertenece a un estudio al que no esta asignado',
};

export function motivoLegible(motivo: Motivo): string {
  return MOTIVOS[motivo];
}

/**
 * Arma la entrada de auditoria para una decision.
 * Si fue denegada, el motivo queda en `detalle` para poder explicarla.
 */
export function construirEntrada(
  sujeto: Sujeto,
  permiso: Permiso,
  recurso: RecursoRef,
  decision: Decision,
  detalle: Record<string, unknown> = {},
): EntradaAuditoria {
  const [entidad, accion] = permiso.split(':');

  return {
    usuarioId: sujeto.usuarioId,
    rolCodigo: decision.rol ?? null,
    estudioId: recurso.estudioId,
    entidad,
    entidadId: recurso.id ?? '-',
    accion,
    resultado: decision.permitido ? 'permitido' : 'denegado',
    detalle: decision.permitido
      ? detalle
      : { ...detalle, motivo: decision.motivo, explicacion: motivoLegible(decision.motivo) },
  };
}
