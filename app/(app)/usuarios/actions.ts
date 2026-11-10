'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { pool } from '@/lib/db';
import { requireSesion, decidir } from '@/lib/guard';
import { auditar } from '@/lib/audit';
import { hashearPassword } from '@/lib/auth';

const ROLES_VALIDOS = ['sys-admin', 'jefe-estudio', 'medico-investigador'];

function mensaje(base: string, clave: 'error' | 'ok', texto: string): string {
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${clave}=${encodeURIComponent(texto)}`;
}

export async function crearUsuario(formData: FormData): Promise<void> {
  const sesion = await requireSesion();
  const volver = '/usuarios';

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const nombre = String(formData.get('nombre') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const rol = String(formData.get('rol') ?? '');
  const estudioId = String(formData.get('estudioId') ?? '') || null;

  const error = (texto: string): never => redirect(mensaje(volver, 'error', texto));

  if (!email || !nombre || !password || !rol) error('Completa correo, nombre, contraseña y rol.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) error('El correo no tiene un formato válido.');
  if (password.length < 8) error('La contraseña debe tener al menos 8 caracteres.');
  if (!ROLES_VALIDOS.includes(rol)) error('Rol no válido.');

  const rolGlobal = rol === 'sys-admin';
  if (!rolGlobal && !estudioId) error('Los roles de estudio requieren un estudio asignado.');

  const recursoUsuario = { tipo: 'usuario' as const, estudioId: null };
  const dUsuario = decidir(sesion, 'usuario:create', recursoUsuario);

  if (!dUsuario.permitido) {
    await auditar(sesion, 'usuario:create', recursoUsuario, { email }, dUsuario);
    redirect(mensaje(volver, 'error', 'No tienes permiso para crear usuarios.'));
  }

  let dAsignacion = null;
  if (!rolGlobal && estudioId) {
    dAsignacion = decidir(sesion, 'asignacion:create', {
      tipo: 'asignacion',
      estudioId,
    });
    if (!dAsignacion.permitido) {
      await auditar(sesion, 'asignacion:create', { tipo: 'asignacion', estudioId }, { email }, dAsignacion);
      redirect(mensaje(volver, 'error', 'No tienes permiso para asignar usuarios a ese estudio.'));
    }
  } else if (rolGlobal) {
    dAsignacion = decidir(sesion, 'asignacion:create', {
      tipo: 'asignacion',
      estudioId: null,
    });
    if (!dAsignacion.permitido) {
      await auditar(
        sesion,
        'asignacion:create',
        { tipo: 'asignacion', estudioId: null },
        { email },
        dAsignacion,
      );
      redirect(mensaje(volver, 'error', 'No tienes permiso para crear administradores.'));
    }
  }

  const cliente = await pool.connect();
  let creado = false;

  try {
    await cliente.query('BEGIN');

    const q = await cliente.query(
      `INSERT INTO usuario (email, nombre, password_hash, creado_por)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [email, nombre, hashearPassword(password), sesion.usuario.id],
    );

    const nuevoId: string = q.rows[0].id;

    await auditar(
      sesion,
      'usuario:create',
      { tipo: 'usuario', id: nuevoId, estudioId: null },
      { email, rol },
      dUsuario,
      cliente,
    );

    if (dAsignacion) {
      const estudioAsignado = rolGlobal ? null : estudioId;
      const a = await cliente.query(
        `INSERT INTO asignacion (usuario_id, estudio_id, rol_codigo, activa, creada_por)
         VALUES ($1, $2, $3, true, $4)
         RETURNING id`,
        [nuevoId, estudioAsignado, rol, sesion.usuario.id],
      );

      await auditar(
        sesion,
        'asignacion:create',
        { tipo: 'asignacion', id: a.rows[0].id, estudioId: estudioAsignado },
        { usuario_id: nuevoId, rol },
        dAsignacion,
        cliente,
      );
    }

    await cliente.query('COMMIT');
    creado = true;
  } catch (e) {
    await cliente.query('ROLLBACK');
    if ((e as { code?: string }).code === '23505') {
      error('Ya existe un usuario con ese correo.');
    }
    throw e;
  } finally {
    cliente.release();
  }

  if (creado) {
    revalidatePath('/usuarios');
    revalidatePath('/asignaciones');
    redirect(mensaje(volver, 'ok', `Usuario ${email} creado.`));
  }
}

export async function cambiarEstadoUsuario(formData: FormData): Promise<void> {
  const sesion = await requireSesion();
  const usuarioId = String(formData.get('usuarioId') ?? '');
  const activar = String(formData.get('activar') ?? 'false') === 'true';
  const volver = '/usuarios';

  if (!usuarioId) redirect(mensaje(volver, 'error', 'Usuario no válido.'));

  if (usuarioId === sesion.usuario.id) {
    redirect(mensaje(volver, 'error', 'No puedes cambiar el estado de tu propia cuenta.'));
  }

  const permiso = activar ? 'usuario:update' : 'usuario:deactivate';
  const recurso = { tipo: 'usuario' as const, id: usuarioId, estudioId: null };
  const decision = decidir(sesion, permiso, recurso);

  if (!decision.permitido) {
    await auditar(sesion, permiso, recurso, { activar }, decision);
    redirect(mensaje(volver, 'error', 'No tienes permiso para cambiar el estado de usuarios.'));
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    await cliente.query(`UPDATE usuario SET activo = $2 WHERE id = $1`, [usuarioId, activar]);

    if (!activar) {
      // Al desactivar la cuenta se dan de baja sus asignaciones: al
      // reactivarla, un administrador debe volver a asignarla.
      await cliente.query(
        `UPDATE asignacion
         SET activa = false, baja_en = now()
         WHERE usuario_id = $1 AND activa`,
        [usuarioId],
      );
    }

    await auditar(sesion, permiso, recurso, { activar }, decision, cliente);
    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }

  revalidatePath('/usuarios');
  revalidatePath('/asignaciones');
  redirect(
    mensaje(volver, 'ok', activar ? 'Usuario reactivado.' : 'Usuario desactivado y sesión invalidada.'),
  );
}
