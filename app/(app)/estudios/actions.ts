'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { pool } from '@/lib/db';
import { requireSesion, decidir, esGlobal } from '@/lib/guard';
import { auditar } from '@/lib/audit';

function mensaje(base: string, clave: 'error' | 'ok', texto: string): string {
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${clave}=${encodeURIComponent(texto)}`;
}

export async function crearEstudio(formData: FormData): Promise<void> {
  const sesion = await requireSesion();
  const volver = '/estudios';

  const codigo = String(formData.get('codigo') ?? '').trim().toUpperCase();
  const nombre = String(formData.get('nombre') ?? '').trim();
  const patrocinador = String(formData.get('patrocinador') ?? '').trim();

  if (!codigo || !nombre) {
    redirect(mensaje(volver, 'error', 'El código y el nombre son obligatorios.'));
  }
  if (!/^[A-Z0-9-]{2,20}$/.test(codigo)) {
    redirect(
      mensaje(volver, 'error', 'El código debe tener entre 2 y 20 caracteres: letras, números o guiones.'),
    );
  }

  const recurso = { tipo: 'estudio' as const, estudioId: null, nuevo: true };
  const decision = decidir(sesion, 'estudio:create', recurso);

  if (!decision.permitido) {
    await auditar(sesion, 'estudio:create', recurso, { codigo }, decision);
    redirect(mensaje(volver, 'error', 'No tienes permiso para crear estudios.'));
  }

  let creado = false;

  try {
    const q = await pool.query(
      `INSERT INTO estudio (codigo, nombre, patrocinador, creado_por)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [codigo, nombre, patrocinador || null, sesion.usuario.id],
    );

    await auditar(
      sesion,
      'estudio:create',
      { tipo: 'estudio', id: q.rows[0].id, estudioId: null, nuevo: true },
      { codigo, nombre },
      decision,
    );

    creado = true;
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      redirect(mensaje(volver, 'error', `Ya existe un estudio con el código ${codigo}.`));
    }
    throw e;
  }

  if (creado) {
    revalidatePath('/estudios');
    const texto = esGlobal(sesion)
      ? `Estudio ${codigo} creado.`
      : `Estudio ${codigo} creado. Un administrador debe confirmar tu asignación para que puedas acceder.`;
    redirect(mensaje(volver, 'ok', texto));
  }
}
