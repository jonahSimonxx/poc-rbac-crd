'use server';

import { requireSesion, rolConcede } from '@/lib/guard';
import { auditar } from '@/lib/audit';
import { verificarCadena } from '@/lib/data';

export interface VerificacionState {
  total: number;
  integra: boolean;
  primerError: number | null;
  fecha: string;
  error?: string;
}

export async function verificarCadenaAction(
  _previo: VerificacionState | null,
  _formData: FormData,
): Promise<VerificacionState> {
  const sesion = await requireSesion();

  const admin = rolConcede(sesion, 'auditoria_admin:read');
  const clinica = rolConcede(sesion, 'auditoria_clinica:read');

  if (!admin && !clinica) {
    return {
      total: 0,
      integra: false,
      primerError: null,
      fecha: new Date().toISOString(),
      error: 'No tienes permiso para verificar la auditoría.',
    };
  }

  const resultado = await verificarCadena();
  const fecha = new Date().toISOString();

  if (admin) {
    await auditar(
      sesion,
      'auditoria_admin:read',
      { tipo: 'auditoria_admin', estudioId: null },
      { accion: 'verificar_cadena', total: resultado.total, integra: resultado.integra },
    );
  } else {
    await auditar(
      sesion,
      'auditoria_clinica:read',
      { tipo: 'auditoria_clinica', estudioId: sesion.estudios[0]?.id ?? null },
      { accion: 'verificar_cadena', total: resultado.total, integra: resultado.integra },
    );
  }

  return { ...resultado, fecha };
}
