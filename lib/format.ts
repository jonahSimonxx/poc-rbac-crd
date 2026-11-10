// Utilidades de formato para las vistas.

import type { RolCodigo } from '../src/core/catalog.ts';

export const ETIQUETA_ROL: Record<RolCodigo, string> = {
  'sys-admin': 'Administrador',
  'jefe-estudio': 'Jefe de estudio',
  'medico-investigador': 'Médico investigador',
};

export const ETIQUETA_CRD: Record<string, string> = {
  inclusion: 'Inclusión',
  evaluacion_inicial: 'Evaluación inicial',
  evaluacion_intermedia: 'Evaluación intermedia',
  evaluacion_final: 'Evaluación final',
  examen_fisico: 'Examen físico',
  laboratorio: 'Laboratorio',
  tratamiento_concomitante: 'Tratamiento concomitante',
  fallecimiento: 'Fallecimiento',
  interrupcion: 'Interrupción',
  imagenes: 'Imágenes',
};

export const ETIQUETA_ENTIDAD: Record<string, string> = {
  usuario: 'Usuario',
  asignacion: 'Asignación',
  sesion: 'Sesión',
  estudio: 'Estudio',
  sitio: 'Sitio',
  auditoria: 'Auditoría',
  paciente: 'Paciente',
  identidad: 'Identidad',
  crd: 'CRD',
  dosis: 'Dosis',
  evento: 'Evento adverso',
  auditoria_clinica: 'Auditoría clínica',
  auditoria_admin: 'Auditoría administrativa',
  paciente_identidad: 'Identidad',
};

export function fecha(valor: Date | string | null | undefined): string {
  if (!valor) return '—';
  const d = typeof valor === 'string' ? new Date(valor) : valor;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fechaCorta(valor: Date | string | null | undefined): string {
  if (!valor) return '—';
  const d = typeof valor === 'string' ? new Date(valor) : valor;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function hashCorto(h: string | null | undefined): string {
  if (!h) return '—';
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

export function inicialesDe(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
