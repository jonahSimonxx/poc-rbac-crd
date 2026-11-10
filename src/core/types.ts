// ============================================================
//  Tipos del dominio de autorizacion
// ============================================================

import type { Recurso, RolCodigo } from './catalog.ts';

/** Vinculo entre un usuario, un estudio y un rol (ADR-001 D4). */
export interface Asignacion {
  readonly rol: RolCodigo;
  /** null = rol global (solo sys-admin). */
  readonly estudioId: string | null;
  readonly activa: boolean;
}

/** Sujeto que intenta ejecutar una accion. */
export interface Sujeto {
  readonly usuarioId: string;
  readonly nombre?: string;
  readonly activo: boolean;
  readonly asignaciones: readonly Asignacion[];
}

/** Recurso sobre el que se quiere actuar. */
export interface RecursoRef {
  readonly tipo: Recurso;
  readonly id?: string;
  /** Estudio al que pertenece el recurso; null si es global o aún no existe. */
  readonly estudioId: string | null;
  /**
   * true cuando el recurso se está creando y todavía no tiene estudio.
   * En ese caso no hay ámbito que comprobar: basta con que el rol conceda
   * el permiso. Es el caso de "crear estudio" por parte de un jefe.
   */
  readonly nuevo?: boolean;
}

export type Motivo =
  | 'ok'
  | 'usuario_inactivo'
  | 'sin_asignacion'
  | 'permiso_no_otorgado'
  | 'fuera_de_ambito';

export interface Decision {
  readonly permitido: boolean;
  readonly motivo: Motivo;
  readonly rol?: RolCodigo;
}
