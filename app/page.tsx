import { redirect } from 'next/navigation';

import { sesionActual } from '@/lib/guard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const sesion = await sesionActual();
  redirect(sesion ? '/panel' : '/login');
}
