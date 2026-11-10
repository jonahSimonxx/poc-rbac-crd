'use server';

import { redirect } from 'next/navigation';

import { cerrarSesion } from '@/lib/session';

export async function logout(): Promise<void> {
  await cerrarSesion();
  redirect('/login');
}
