// ============================================================
//  Catalogo de permisos y roles (fuente de verdad en codigo)
//
//  ADR-001: 3 roles, deny by default, ambito por estudio.
//  Este archivo es el contrato: si un permiso no esta aca, no existe.
// ============================================================

export const PERMISOS = [
  // Administracion de usuarios y estructura (sys-admin)
  'usuario:read',
  'usuario:create',
  'usuario:update',
  'usuario:deactivate',
  'estudio:read',
  'estudio:create',
  'estudio:update',
  'sitio:read',
  'sitio:create',
  'sitio:update',
  'asignacion:read',
  'asignacion:create',
  'asignacion:revoke',
  'auditoria_admin:read',

  // Trabajo clinico (medico-investigador)
  'paciente:read',
  'paciente:create',
  'paciente:update',
  'paciente:annul',
  'identidad:read',
  'identidad:create',
  'identidad:update',
  'crd:read',
  'crd:create',
  'crd:update',
  'crd:sign',
  'crd:annul',
  'dosis:read',
  'dosis:create',
  'dosis:update',
  'dosis:annul',
  'evento:read',
  'evento:create',
  'evento:update',

  // Supervision (jefe-estudio)
  'auditoria_clinica:read',
  'exportacion:export',
] as const;

export type Permiso = (typeof PERMISOS)[number];

// "paciente:read" -> "paciente"
export type Recurso = Permiso extends `${infer R}:${string}` ? R : never;

// "paciente:read" -> "read"
export type Accion = Permiso extends `${string}:${infer A}` ? A : never;

export interface DefinicionRol {
  readonly nombre: string;
  readonly descripcion: string;
  /** Un rol global no requiere asignacion a un estudio. */
  readonly global: boolean;
  readonly permisos: readonly Permiso[];
}

export const ROLES = {
  'sys-admin': {
    nombre: 'Administrador del sistema',
    descripcion: 'Gestiona cuentas, asignaciones y catalogos. Sin acceso a datos clinicos.',
    global: true,
    permisos: [
      'usuario:read',
      'usuario:create',
      'usuario:update',
      'usuario:deactivate',
      'estudio:read',
      'estudio:create',
      'estudio:update',
      'sitio:read',
      'asignacion:read',
      'asignacion:create',
      'asignacion:revoke',
      'auditoria_admin:read',
    ],
  },
  'jefe-estudio': {
    nombre: 'Jefe de estudio',
    descripcion: 'Dirige el estudio, asigna investigadores, supervisa y lee la auditoria clinica.',
    global: false,
    permisos: [
      'estudio:read',
      'estudio:create',
      'estudio:update',
      'sitio:read',
      'sitio:create',
      'sitio:update',
      'asignacion:read',
      'asignacion:create',
      'asignacion:revoke',
      'paciente:read',
      'identidad:read',
      'crd:read',
      'dosis:read',
      'evento:read',
      'auditoria_clinica:read',
      'exportacion:export',
    ],
  },
  'medico-investigador': {
    nombre: 'Medico investigador',
    descripcion: 'Carga pacientes, CRD, dosis y eventos adversos. Firma y cierra.',
    global: false,
    permisos: [
      'estudio:read',
      'sitio:read',
      'paciente:read',
      'paciente:create',
      'paciente:update',
      'paciente:annul',
      'identidad:read',
      'identidad:create',
      'identidad:update',
      'crd:read',
      'crd:create',
      'crd:update',
      'crd:sign',
      'crd:annul',
      'dosis:read',
      'dosis:create',
      'dosis:update',
      'dosis:annul',
      'evento:read',
      'evento:create',
      'evento:update',
    ],
  },
} as const;

export type RolCodigo = keyof typeof ROLES;

export const ROLES_LISTA = Object.keys(ROLES) as RolCodigo[];

/** Permisos de un rol, en orden alfabetico. */
export function permisosDe(rol: RolCodigo): readonly Permiso[] {
  return ROLES[rol].permisos;
}

/** Verifica que el catalogo de roles solo use permisos existentes. */
export function validarCatalogo(): string[] {
  const errores: string[] = [];
  const conocidos = new Set<string>(PERMISOS);

  for (const rol of ROLES_LISTA) {
    for (const p of ROLES[rol].permisos) {
      if (!conocidos.has(p)) errores.push(`Rol ${rol}: permiso desconocido "${p}"`);
    }
    if (new Set(ROLES[rol].permisos).size !== ROLES[rol].permisos.length) {
      errores.push(`Rol ${rol}: tiene permisos duplicados`);
    }
  }

  return errores;
}
