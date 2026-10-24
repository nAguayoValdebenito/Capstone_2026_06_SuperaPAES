// Tipos del dominio que usa la consola. Los roles salen del modelo de datos.

/** Roles de cuenta interna (códigos de contenido.rol). */
export const ROLES_CUENTA_INTERNA = ['admin', 'docente'] as const;
export type RolCuentaInterna = (typeof ROLES_CUENTA_INTERNA)[number];

export function esRolCuentaInterna(valor: string): valor is RolCuentaInterna {
  return ROLES_CUENTA_INTERNA.some((rol) => rol === valor);
}

/**
 * Rol de un docente en una asignación de revisión. Es un dato de la asignación, no un permiso.
 * @esqueleto Rol de una asignación de revisión; lo usarán las páginas del docente.
 */
export type RolAsignacion = 'revisor' | 'desempate';

export interface UsuarioInterno {
  id: string;
  /** El token de la consola no trae el nombre: falta mientras el ingreso no lo devuelva (HU-03.1). */
  nombre?: string;
  rol: RolCuentaInterna;
}

/** Respuesta de POST /api/v1/admin/cuentas/ingreso (SesionIniciada del módulo cuentas). */
export interface SesionIniciada {
  tokenAcceso: string;
  tokenRenovacion: string;
}

export interface Credenciales {
  correo: string;
  contrasena: string;
}

/** Área de especialidad de los docentes (contenido.area). */
export interface Area {
  id: number;
  nombre: string;
}

/** Cuenta interna en la gestión de usuarios internos (C10, CU-23). Nunca trae la contraseña. */
export interface CuentaInterna {
  id: string;
  nombre: string;
  correo: string;
  rol: RolCuentaInterna;
  activo: boolean;
  /** Ids de las áreas que puede revisar (solo docentes). */
  areas: number[];
  creadoEn: string;
  ultimoAcceso: string | null;
}

/** Al crear, el administrador escribe la contraseña inicial (RF-C02, RN-31). */
export interface DatosCuentaNueva {
  nombre: string;
  correo: string;
  rol: RolCuentaInterna;
  areas: number[];
  contrasena: string;
}

/** Al editar no se cambia el correo; la contraseña se envía solo si se asigna una nueva. */
export type CambiosCuenta = Partial<Omit<DatosCuentaNueva, 'correo'>>;

export interface EstadoSalud {
  estado: 'ok';
  baseDeDatos: 'ok';
}

/** Formato único de respuesta de la API. */
export interface CuerpoRespuesta<T> {
  data: T | null;
  error: { codigo: string; mensaje: string; detalles?: unknown } | null;
  meta: Record<string, unknown> | null;
}
