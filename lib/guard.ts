// ============================================================
//  Guardas de servidor
//
//  Toda pagina y accion pasa por aqui. La sesion se recarga en
//  cada peticion, asi que una asignacion revocada deja de valer
//  de inmediato.
// ============================================================

import { redirect } from 'next/navigation';

import { cargarSesion, type Sesion } from './auth.ts';
import { leerSesion } from './session.ts';
import { can } from '../src/core/policy.ts';
import { ROLES } from '../src/core/catalog.ts';
import type { Permiso, RolCodigo } from '../src/core/catalog.ts';
import type { Decision, RecursoRef } from '../src/core/types.ts';

export async function sesionActual(): Promise<Sesion | null> {
  const uid = await leerSesion();
  if (!uid) return null;
  return cargarSesion(uid);
}

export async function requireSesion(): Promise<Sesion> {
  const s = await sesionActual();
  if (!s) redirect('/login');
  return s;
}

/** Comprueba un permiso en un recurso y devuelve la decision. */
export function decidir(sesion: Sesion, permiso: Permiso, recurso: RecursoRef): Decision {
  return can(sesion.sujeto, permiso, recurso);
}

/** true si alguno de los roles del usuario concede el permiso (sin mirar ambito). */
export function rolConcede(sesion: Sesion, permiso: Permiso): boolean {
  return sesion.sujeto.asignaciones.some(
    (a) => a.activa && (ROLES[a.rol].permisos as readonly string[]).includes(permiso),
  );
}

export function rolesDe(sesion: Sesion): RolCodigo[] {
  return [...new Set(sesion.sujeto.asignaciones.filter((a) => a.activa).map((a) => a.rol))];
}

export function esGlobal(sesion: Sesion): boolean {
  return sesion.sujeto.asignaciones.some((a) => a.activa && ROLES[a.rol].global);
}

/** Estudios donde el usuario tiene asignacion activa (vacio si es global). */
export function estudiosPermitidos(sesion: Sesion): string[] {
  return [...new Set(
    sesion.sujeto.asignaciones
      .filter((a) => a.activa && a.estudioId)
      .map((a) => a.estudioId as string),
  )];
}
