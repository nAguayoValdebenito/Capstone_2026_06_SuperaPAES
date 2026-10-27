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

/** Opción de una lista de la API (estado, origen, dificultad): se identifica por su código. */
export interface Opcion {
  codigo: string;
  nombre: string;
}

/** Origen de una pregunta, deducido por la API del lote de IA o de la importación. */
export type OrigenPregunta = 'manual' | 'importacion' | 'ia';

/** Prueba con sus ejes (y los contenidos de cada eje) y sus habilidades, para los filtros del banco. */
export interface PruebaTemario {
  id: number;
  codigo: string;
  nombre: string;
  ejes: { id: number; nombre: string; contenidos: { id: number; nombre: string }[] }[];
  habilidades: { id: number; nombre: string }[];
}

/** Opciones de los filtros del banco (GET /admin/preguntas/filtros). */
export interface OpcionesFiltrosBanco {
  pruebas: PruebaTemario[];
  estados: Opcion[];
  origenes: Opcion[];
  dificultades: Opcion[];
}

/** Filtros elegidos en el banco (C02, HU-11). Un filtro sin valor no se aplica. */
export interface FiltrosBanco {
  prueba?: number;
  eje?: number;
  contenido?: number;
  habilidad?: number;
  estado?: string;
  origen?: OrigenPregunta;
  /** La dificultad asignada por los docentes. */
  dificultad?: string;
}

/** Pregunta tal como la lista el banco: con su estado, sin la alternativa correcta. */
export interface PreguntaDelBanco {
  id: number;
  resumen: string;
  prueba: { id: number; codigo: string; nombre: string };
  eje: { id: number; nombre: string };
  contenido: { id: number; nombre: string };
  estado: Opcion;
  origen: OrigenPregunta;
  dificultadSugerida: Opcion | null;
  dificultadAsignada: Opcion | null;
  /** Un revisor dijo fácil y el otro difícil ("posiblemente confusa" en C02). */
  posibleAmbigua: boolean;
  actualizadoEn: string;
}

/** Paginación de un listado de la API (`meta`). */
export interface Paginacion {
  pagina: number;
  porPagina: number;
  total: number;
}

export interface PaginaDelBanco {
  preguntas: PreguntaDelBanco[];
  paginacion: Paginacion;
}

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
