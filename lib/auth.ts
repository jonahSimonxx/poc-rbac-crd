// ============================================================
//  Autenticacion y carga del sujeto
//
//  La contrasena se guarda como:
//    scrypt$N$r$p$<saltHex>$<keyHex>
// ============================================================

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

import { pool } from './db.ts';
import type { RolCodigo } from '../src/core/catalog.ts';
import type { Asignacion, Sujeto } from '../src/core/types.ts';

export interface UsuarioSesion {
  readonly id: string;
  readonly email: string;
  readonly nombre: string;
  readonly activo: boolean;
}

export interface EstudioSesion {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
}

export interface Sesion {
  readonly usuario: UsuarioSesion;
  readonly sujeto: Sujeto;
  readonly estudios: readonly EstudioSesion[];
}

export function hashearPassword(password: string): string {
  const N = 16384;
  const r = 8;
  const p = 1;
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password, salt, 64, { N, r, p }).toString('hex');
  return `scrypt$${N}$${r}$${p}$${salt}$${key}`;
}

export function verificarPassword(password: string, almacenado: string): boolean {
  const partes = almacenado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;

  const [, n, r, p, salt, keyHex] = partes;
  const N = Number(n);
  const R = Number(r);
  const P = Number(p);

  if (!Number.isFinite(N) || !Number.isFinite(R) || !Number.isFinite(P)) return false;

  try {
    const esperada = Buffer.from(keyHex, 'hex');
    const calculada = scryptSync(password, salt, esperada.length, { N, r: R, p: P });
    if (esperada.length !== calculada.length) return false;
    return timingSafeEqual(esperada, calculada);
  } catch {
    return false;
  }
}

export async function autenticar(
  email: string,
  password: string,
): Promise<UsuarioSesion | null> {
  const { rows } = await pool.query(
    `SELECT id, email, nombre, password_hash, activo
     FROM usuario
     WHERE lower(email) = lower($1)`,
    [email.trim()],
  );

  const u = rows[0];
  if (!u || !u.activo) return null;
  if (!verificarPassword(password, u.password_hash)) return null;

  return { id: u.id, email: u.email, nombre: u.nombre, activo: u.activo };
}

export async function cargarSesion(usuarioId: string): Promise<Sesion | null> {
  const usuarioQ = await pool.query(
    `SELECT id, email, nombre, activo FROM usuario WHERE id = $1`,
    [usuarioId],
  );

  const u = usuarioQ.rows[0];
  if (!u || !u.activo) return null;

  const asignacionesQ = await pool.query(
    `SELECT a.rol_codigo, a.estudio_id, a.activa,
            e.codigo AS estudio_codigo, e.nombre AS estudio_nombre
     FROM asignacion a
     LEFT JOIN estudio e ON e.id = a.estudio_id
     WHERE a.usuario_id = $1 AND a.activa
     ORDER BY e.codigo NULLS FIRST`,
    [usuarioId],
  );

  const asignaciones: Asignacion[] = asignacionesQ.rows.map((r) => ({
    rol: r.rol_codigo as RolCodigo,
    estudioId: r.estudio_id,
    activa: r.activa,
  }));

  const estudios: EstudioSesion[] = [];
  const vistos = new Set<string>();
  for (const r of asignacionesQ.rows) {
    if (!r.estudio_id || vistos.has(r.estudio_id)) continue;
    vistos.add(r.estudio_id);
    estudios.push({ id: r.estudio_id, codigo: r.estudio_codigo, nombre: r.estudio_nombre });
  }

  return {
    usuario: { id: u.id, email: u.email, nombre: u.nombre, activo: u.activo },
    sujeto: {
      usuarioId: u.id,
      nombre: u.nombre,
      activo: u.activo,
      asignaciones,
    },
    estudios,
  };
}
