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

/**
 * Prueba con sus ejes (y los contenidos de cada eje), sus habilidades y los tipos de pregunta que
 * admite, para los filtros del banco y el formulario C03. opcionesMin, opcionesMax y requiereTexto son
 * las reglas de RN-08.
 */
export interface PruebaTemario {
  id: number;
  codigo: string;
  nombre: string;
  opcionesMin: number;
  opcionesMax: number;
  requiereTexto: boolean;
  ejes: { id: number; nombre: string; contenidos: { id: number; nombre: string }[] }[];
  habilidades: { id: number; nombre: string }[];
  tiposPregunta: Opcion[];
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

/** HU-24 (CU-21): publicar una aprobada, retirar una publicada o volver a borrador una retirada. */
export type CambioDeEtapa = 'publicar' | 'retirar' | 'borrador';

/** La pregunta con la etapa en que quedó después de publicarla, retirarla o volverla a borrador. */
export interface PreguntaConEtapa {
  id: number;
  estado: Opcion;
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
  /** La etapa permite editarla y enviarla a revisión (borrador u observada). */
  editable: boolean;
  actualizadoEn: string;
}

/** Letra de una alternativa, en orden. */
export const LETRAS = ['A', 'B', 'C', 'D', 'E'] as const;
export type Letra = (typeof LETRAS)[number];

export interface AlternativaPregunta {
  letra: Letra;
  texto: string;
  esCorrecta: boolean;
  explicacion: string | null;
}

/** Texto de lectura que se escribe en el formulario (HU-12.2). */
export interface DatosTexto {
  tipoTexto: string;
  titulo: string;
  contenido: string | null;
  imagenUrl: string | null;
}

/** Lo que la consola envía al crear o editar una pregunta (C03, HU-12.1). */
export interface DatosPregunta {
  pruebaId: number;
  contenidoId: number;
  habilidadId: number;
  tipoPregunta: string;
  dificultadSugerida: string | null;
  enunciado: string;
  explicacion: string;
  textoEstimuloId: number | null;
  textoNuevo: DatosTexto | null;
  ordenEnTexto: number | null;
  alternativas: AlternativaPregunta[];
}

/** La pregunta guardada, con la correcta: solo la ve el administrador. */
export interface PreguntaParaEditar extends Omit<
  DatosPregunta,
  'textoNuevo' | 'alternativas' | 'dificultadSugerida'
> {
  id: number;
  ejeId: number;
  dificultadSugerida: string | null;
  estado: Opcion;
  /** RF-G09: solo en borrador u observada. */
  editable: boolean;
  version: number;
  origen: OrigenPregunta;
  alternativas: (AlternativaPregunta & { id: number })[];
  actualizadoEn: string;
}

/** Texto de lectura en la lista para elegir uno guardado. */
export interface TextoDeLectura {
  id: number;
  tipoTexto: Opcion;
  titulo: string | null;
  resumen: string | null;
  imagenUrl: string | null;
  preguntas: number;
  creadoEn: string;
}

/** Un archivo CSV de la importación (HU-13), leído como UTF-8. */
export interface ArchivoCsv {
  nombre: string;
  contenido: string;
}

/** Los archivos que se revisan o importan: preguntas y, si hay, textos de lectura. */
export interface ArchivosImportacion {
  preguntas: ArchivoCsv;
  textos: ArchivoCsv | null;
}

/** Una fila que no se importa, con sus motivos (tabla «Filas con errores» de C04). */
export interface ErrorDeFila {
  archivo: 'preguntas' | 'textos';
  fila: number;
  resumen: string;
  motivos: string[];
}

/** El informe de C04 (CU-16 paso 5). */
export interface InformeImportacion {
  filasLeidas: number;
  porCrear: number;
  omitidas: number;
  conError: number;
  textosPorCrear: number;
  errores: ErrorDeFila[];
}

export interface ImportacionHecha extends InformeImportacion {
  id: number;
}

/** Un revisor asignado a la pregunta (HU-21), con su fecha límite. */
export interface RevisorAsignado {
  asignacionId: number;
  docente: { id: number; nombre: string; correo: string };
  venceEn: string;
}

/** La pregunta enviada a revisión (HU-21): su ronda, la versión que se revisa y sus revisores. */
export interface EnvioARevision {
  preguntaId: number;
  ronda: number;
  version: number;
  revisores: RevisorAsignado[];
}

/** Una revisión pendiente en la bandeja del docente (D01, HU-22). */
export interface RevisionPendiente {
  id: number;
  preguntaId: number;
  ronda: number;
  prueba: { codigo: string; nombre: string };
  contenido: string;
  venceEn: string;
}

/** Un punto de la pauta docente (contenido.criterio_pauta). */
export interface CriterioPauta {
  codigo: string;
  descripcion: string;
}

/**
 * La pregunta que revisa el docente, tal como se envió a revisión, con la correcta y la explicación.
 * A ciegas (HU-22 esc. 3): no trae la dificultad sugerida ni la revisión del otro docente.
 */
export interface PreguntaARevisar extends RevisionPendiente {
  eje: string;
  habilidad: string;
  enunciado: string;
  explicacion: string;
  alternativas: {
    id: number;
    letra: Letra;
    texto: string;
    explicacion: string | null;
    esCorrecta: boolean;
  }[];
  texto: { titulo: string | null; contenido: string | null; imagenUrl: string | null } | null;
  pauta: CriterioPauta[];
  dificultades: Opcion[];
  decisiones: (Opcion & { requiereComentario: boolean })[];
}

/** La revisión que entrega el docente (CU-19 pasos 3 a 5). */
export interface DatosRevision {
  criterios: { codigo: string; cumple: boolean; observacion: string | null }[];
  dificultad: string;
  decision: string;
  comentario: string | null;
}

export interface RevisionEntregada {
  asignacionId: number;
  preguntaId: number;
  decision: string;
  dificultad: string;
}

/** Lo que entregó un revisor de la ronda, sin decir quién (D02, HU-23). */
export interface RevisionDelRevisor {
  decision: Opcion;
  dificultad: Opcion;
  comentario: string | null;
  criterios: (CriterioPauta & { cumple: boolean; observacion: string | null })[];
}

/** La pregunta en desempate con las revisiones de la ronda y si es posiblemente confusa (CU-20). */
export interface DesempateAbierto extends Omit<PreguntaARevisar, 'pauta'> {
  revisiones: RevisionDelRevisor[];
  posibleAmbigua: boolean;
}

/** La decisión del tercer docente: la dificultad final, la decisión y el motivo (CU-20). */
export type DatosDesempate = Omit<DatosRevision, 'criterios'>;

/** El desempate entregado y la etapa en que queda la pregunta. */
export interface DesempateEntregado extends RevisionEntregada {
  estado: 'aprobada' | 'rechazada' | 'observada';
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
