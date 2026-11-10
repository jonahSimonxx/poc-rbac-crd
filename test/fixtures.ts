// Datos de prueba compartidos por los tests.

import type { Recurso, RolCodigo } from '../src/core/catalog.ts';
import type { Asignacion, RecursoRef, Sujeto } from '../src/core/types.ts';

export const ENOXA = 'est-enoxa';
export const GRANI = 'est-grani';

export function sujeto(
  rol: RolCodigo,
  estudioId: string | null = ENOXA,
  opciones: { activo?: boolean; asignacionActiva?: boolean } = {},
): Sujeto {
  return {
    usuarioId: `u-${rol}`,
    nombre: rol,
    activo: opciones.activo ?? true,
    asignaciones: [
      { rol, estudioId, activa: opciones.asignacionActiva ?? true },
    ],
  };
}

export function sujetoCon(
  usuarioId: string,
  asignaciones: Asignacion[],
  activo = true,
): Sujeto {
  return { usuarioId, nombre: usuarioId, activo, asignaciones };
}

export function recurso(
  tipo: Recurso,
  estudioId: string | null = ENOXA,
  id = 'r-1',
): RecursoRef {
  return { tipo, estudioId, id };
}
