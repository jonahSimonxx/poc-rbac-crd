'use server';

import { redirect } from 'next/navigation';

import { autenticar } from '@/lib/auth';
import { crearSesion } from '@/lib/session';
import { auditarAnonimo } from '@/lib/audit';
import { pool } from '@/lib/db';

export interface LoginState {
  error?: string;
}

export async function login(
  _previo: LoginState | null,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Ingresa correo y contraseña.' };
  }

  const usuario = await autenticar(email, password);

  if (!usuario) {
    await auditarAnonimo('sesion', email, 'login', {
      motivo: 'credenciales invalidas',
    });
    return { error: 'Credenciales inválidas o usuario inactivo.' };
  }

  await crearSesion(usuario.id);

  await pool.query(
    `INSERT INTO auditoria
       (usuario_id, rol_codigo, estudio_id, entidad, entidad_id, accion, resultado, detalle)
     VALUES ($1, NULL, NULL, 'sesion', $1::text, 'login', 'permitido', '{"origen":"web"}'::jsonb)`,
    [usuario.id],
  );

  redirect('/panel');
}
