// ============================================================
//  Resolucion de ambito
//
//  El ambito se define por estudio (ADR-001 D3). El sitio es un
//  dato del paciente, no una dimension de permisos.
// ============================================================

import { ROLES } from './catalog.ts';
import type { Sujeto } from './types.ts';

export interface Ambito {
  /** true si el sujeto tiene un rol global (sys-admin). */
  readonly global: boolean;
  /** Estudios donde tiene alguna asignacion activa. */
  readonly estudios: readonly string[];
}

export function ambitoDe(sujeto: Sujeto | null | undefined): Ambito {
  if (!sujeto || !sujeto.activo) return { global: false, estudios: [] };

  const activas = sujeto.asignaciones.filter((a) => a.activa);

  return {
    global: activas.some((a) => ROLES[a.rol].global),
    estudios: [
      ...new Set(
        activas
          .map((a) => a.estudioId)
          .filter((id): id is string => id !== null),
      ),
    ],
  };
}

export function tieneAccesoAlEstudio(
  sujeto: Sujeto | null | undefined,
  estudioId: string | null | undefined,
): boolean {
  if (!estudioId) return false;
  const ambito = ambitoDe(sujeto);
  return ambito.global || ambito.estudios.includes(estudioId);
}

/**
 * Filtra una lista de recursos por el ambito del sujeto.
 * Un rol global ve todo; los demas solo sus estudios.
 */
export function filtrarPorAmbito<T extends { estudioId: string | null }>(
  sujeto: Sujeto | null | undefined,
  items: readonly T[],
): T[] {
  const ambito = ambitoDe(sujeto);
  if (ambito.global) return [...items];
  if (ambito.estudios.length === 0) return [];

  const propios = new Set(ambito.estudios);
  return items.filter((i) => i.estudioId !== null && propios.has(i.estudioId));
}
