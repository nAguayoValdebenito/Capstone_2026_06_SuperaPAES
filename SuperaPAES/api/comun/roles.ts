// Roles tomados del modelo de datos. No se inventan otros.

/** Rol de cuenta interna (contenido.usuario_interno.rol). Son los únicos que protegen rutas. */
export const ROLES_CUENTA_INTERNA = ['admin', 'docente'] as const;
export type RolCuentaInterna = (typeof ROLES_CUENTA_INTERNA)[number];

export function esRolCuentaInterna(valor: unknown): valor is RolCuentaInterna {
  return ROLES_CUENTA_INTERNA.some((rol) => rol === valor);
}

/**
 * Rol de un docente en una asignación (contenido.asignacion_revision.rol). Es un dato, no un permiso.
 * @esqueleto Roles de contenido.asignacion_revision; los usará el módulo revision.
 */
export const ROLES_ASIGNACION = ['revisor', 'desempate'] as const;
/** @esqueleto Rol de una asignación de revisión; lo usará el módulo revision. */
export type RolAsignacion = (typeof ROLES_ASIGNACION)[number];
