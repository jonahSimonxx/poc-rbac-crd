// ============================================================
//  Motor de decision: can()
//
//  Algoritmo (ADR-001):
//    1. Usuario inactivo -> denegar.
//    2. Sin asignaciones activas -> denegar.
//    3. Ningun rol concede el permiso -> denegar.
//    4. Rol global -> permitir.
//    5. Asignacion activa en el mismo estudio -> permitir.
//    6. En cualquier otro caso -> denegar.
//
//  Es "deny by default": cualquier situacion no contemplada deniega.
// ============================================================

import { ROLES } from './catalog.ts';
import type { Permiso, RolCodigo } from './catalog.ts';
import type { Decision, Motivo, RecursoRef, Sujeto } from './types.ts';

function denegar(motivo: Motivo, rol?: RolCodigo): Decision {
  return { permitido: false, motivo, rol };
}

export function can(
  sujeto: Sujeto | null | undefined,
  permiso: Permiso,
  recurso: RecursoRef,
): Decision {
  // 1. Sujeto inexistente o inactivo
  if (!sujeto) return denegar('sin_asignacion');
  if (!sujeto.activo) return denegar('usuario_inactivo');

  // 2. Asignaciones vigentes
  const activas = sujeto.asignaciones.filter((a) => a.activa);
  if (activas.length === 0) return denegar('sin_asignacion');

  // 3. Algun rol concede el permiso
  const candidatas = activas.filter((a) =>
    (ROLES[a.rol].permisos as readonly string[]).includes(permiso),
  );
  if (candidatas.length === 0) return denegar('permiso_no_otorgado');

  // 4. Rol global (sys-admin)
  const global = candidatas.find((a) => ROLES[a.rol].global);
  if (global) return { permitido: true, motivo: 'ok', rol: global.rol };

  // 5. Ambito por estudio
  if (recurso.estudioId === null) {
    // Un recurso que se esta creando todavia no tiene estudio: no hay
    // ambito que comprobar, solo que el rol conceda el permiso. Es el
    // caso de un jefe de estudio que crea un estudio nuevo (ADR-001).
    if (recurso.nuevo) {
      return { permitido: true, motivo: 'ok', rol: candidatas[0].rol };
    }
    return denegar('fuera_de_ambito');
  }

  const propia = candidatas.find((a) => a.estudioId === recurso.estudioId);
  if (propia) return { permitido: true, motivo: 'ok', rol: propia.rol };

  return denegar('fuera_de_ambito');
}

/** Version booleana, para guardas rapidas. */
export function puede(
  sujeto: Sujeto | null | undefined,
  permiso: Permiso,
  recurso: RecursoRef,
): boolean {
  return can(sujeto, permiso, recurso).permitido;
}

/**
 * Lanza si la decision es denegatoria. Pensado para usarse en
 * servicios que no pueden continuar sin autorizacion.
 */
export function exigir(
  sujeto: Sujeto | null | undefined,
  permiso: Permiso,
  recurso: RecursoRef,
): void {
  const decision = can(sujeto, permiso, recurso);
  if (!decision.permitido) {
    const error = new Error(`Acceso denegado: ${permiso} (${decision.motivo})`);
    error.name = 'AccesoDenegado';
    throw error;
  }
}
