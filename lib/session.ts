// ============================================================
//  Sesion: cookie firmada con HMAC-SHA256
//
//  Solo se guarda el id del usuario. En cada peticion se
//  recargan sus asignaciones, de modo que dar de baja una
//  asignacion surte efecto de inmediato (ADR-001, regla 4).
// ============================================================

import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE = 'crd_sesion';
const MAX_EDAD_SEG = 60 * 60 * 8; // 8 horas

function secreto(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('Falta SESSION_SECRET en el entorno');
  return s;
}

function firmar(payload: string): string {
  return createHmac('sha256', secreto()).update(payload).digest('base64url');
}

export async function crearSesion(usuarioId: string): Promise<void> {
  const payload = Buffer.from(
    JSON.stringify({ uid: usuarioId, iat: Date.now() }),
    'utf8',
  ).toString('base64url');

  const token = `${payload}.${firmar(payload)}`;

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_EDAD_SEG,
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function cerrarSesion(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function leerSesion(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const [payload, firma] = token.split('.');
  if (!payload || !firma) return null;

  const esperada = Buffer.from(firmar(payload));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length) return null;
  if (!timingSafeEqual(esperada, recibida)) return null;

  try {
    const datos = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      uid?: unknown;
      iat?: unknown;
    };

    if (typeof datos.uid !== 'string') return null;
    if (typeof datos.iat !== 'number') return null;
    if (Date.now() - datos.iat > MAX_EDAD_SEG * 1000) return null;

    return datos.uid;
  } catch {
    return null;
  }
}
