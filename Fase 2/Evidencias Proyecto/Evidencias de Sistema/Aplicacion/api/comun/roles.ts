// Roles tomados del modelo de datos. No se inventan otros.

/** Rol de cuenta interna (código de contenido.rol). Son los únicos que protegen rutas. */
export const ROLES_CUENTA_INTERNA = ['admin', 'docente'] as const;
export type RolCuentaInterna = (typeof ROLES_CUENTA_INTERNA)[number];

export function esRolCuentaInterna(valor: unknown): valor is RolCuentaInterna {
  return ROLES_CUENTA_INTERNA.some((rol) => rol === valor);
}

/** Rol de un docente en una asignación (código de contenido.rol_revision). Es un dato, no un permiso. */
export const ROLES_ASIGNACION = ['revisor', 'desempate'] as const;
/** Rol de una asignación de revisión (HU-21 y HU-23). */
export type RolAsignacion = (typeof ROLES_ASIGNACION)[number];
