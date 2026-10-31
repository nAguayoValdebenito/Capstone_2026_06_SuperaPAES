// Cliente HTTP de la consola sobre fetch: URL base, token de sesión y formato { data, error, meta }.
// La consola habla con /api/v1/admin (solicitarAdmin); /api/v1/salud es la única ruta fuera de admin.
import type { CuerpoRespuesta } from '../tipos';

// La API local solo se usa por defecto en desarrollo. En producción VITE_API_URL es obligatoria.
const URL_BASE = (
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3000' : '')
).replace(/\/$/, '');

/** Dirección de una imagen de pregunta: completa, o relativa a la API (como en la app, HU-34.2). */
export function direccionDeImagen(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  return `${URL_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

export class ErrorApi extends Error {
  constructor(
    readonly estadoHttp: number,
    readonly codigo: string,
    mensaje: string,
    readonly detalles?: unknown,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

export interface Respuesta<T> {
  data: T;
  meta: CuerpoRespuesta<T>['meta'];
}

let obtenerToken: () => string | null = () => null;
let alRechazarSesion: () => void = () => undefined;
let renovarSesion: () => Promise<boolean> = () => Promise.resolve(false);
let renovacionEnCurso: Promise<boolean> | null = null;

/** Rutas de ingreso, renovación y cierre: un 401 en ellas no se intenta renovar. */
const RUTAS_DE_SESION = '/admin/cuentas/';

/** Lo configura el estado de sesión (ProveedorSesion) con el token de acceso guardado. */
export function configurarToken(fuente: () => string | null): void {
  obtenerToken = fuente;
}

/**
 * Qué hacer cuando la API responde 401 a una petición que llevaba token: la sesión venció o ya no
 * es válida. Sin token (por ejemplo, en el ingreso) un 401 es solo el error de esa petición.
 */
export function configurarAlRechazarSesion(accion: () => void): void {
  alRechazarSesion = accion;
}

/**
 * Lo configura ProveedorSesion: pide un token de acceso nuevo con la credencial de renovación y
 * responde si lo obtuvo. Se usa una vez cuando la API responde 401 a una petición con token.
 */
export function configurarRenovacion(accion: () => Promise<boolean>): void {
  renovarSesion = accion;
}

/** Varias peticiones rechazadas al mismo tiempo comparten una sola renovación. */
function renovarUnaVez(): Promise<boolean> {
  renovacionEnCurso ??= renovarSesion()
    .catch(() => false)
    .finally(() => {
      renovacionEnCurso = null;
    });
  return renovacionEnCurso;
}

const esSesionRechazada = (error: unknown) => error instanceof ErrorApi && error.estadoHttp === 401;

function esCuerpoRespuesta(valor: unknown): valor is CuerpoRespuesta<unknown> {
  return typeof valor === 'object' && valor !== null && 'data' in valor && 'error' in valor;
}

function armarEncabezados(opciones: RequestInit): Headers {
  const encabezados = new Headers(opciones.headers);
  encabezados.set('Accept', 'application/json');
  if (opciones.body !== undefined) encabezados.set('Content-Type', 'application/json');
  const token = obtenerToken();
  if (token) encabezados.set('Authorization', `Bearer ${token}`);
  return encabezados;
}

async function enviar(ruta: string, opciones: RequestInit): Promise<Response> {
  const encabezados = armarEncabezados(opciones);
  if (!URL_BASE) {
    throw new ErrorApi(
      0,
      'SIN_CONFIGURACION',
      'Falta configurar VITE_API_URL al construir la consola.',
    );
  }
  try {
    return await fetch(`${URL_BASE}/api/v1${ruta}`, { ...opciones, headers: encabezados });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ErrorApi(
      0,
      'SIN_CONEXION',
      'No se pudo conectar con la API. Revisa que esté en marcha.',
    );
  }
}

async function leerCuerpo(respuesta: Response): Promise<CuerpoRespuesta<unknown>> {
  const cuerpo: unknown = await respuesta.json().catch(() => null);
  if (!esCuerpoRespuesta(cuerpo)) {
    throw new ErrorApi(
      respuesta.status,
      'RESPUESTA_INVALIDA',
      `La API respondió ${respuesta.status} con un formato inesperado.`,
    );
  }
  if (!respuesta.ok || cuerpo.error) {
    const error = cuerpo.error;
    throw new ErrorApi(
      respuesta.status,
      error?.codigo ?? 'ERROR_DESCONOCIDO',
      error?.mensaje ?? `La API respondió ${respuesta.status}.`,
      error?.detalles,
    );
  }
  return cuerpo;
}

async function pedir<T>(ruta: string, opciones: RequestInit): Promise<Respuesta<T>> {
  const cuerpo = await leerCuerpo(await enviar(ruta, opciones));
  return { data: cuerpo.data as T, meta: cuerpo.meta };
}

/** Después de renovar, repite la petición una sola vez; si se rechaza de nuevo, la sesión terminó. */
async function repetirTrasRenovar<T>(ruta: string, opciones: RequestInit): Promise<Respuesta<T>> {
  try {
    return await pedir<T>(ruta, opciones);
  } catch (error) {
    if (esSesionRechazada(error)) alRechazarSesion();
    throw error;
  }
}

/**
 * Llama a /api/v1{ruta} y devuelve `data` y `meta`, o lanza ErrorApi con el error de la API.
 * Si la API rechaza una petición con token (401), renueva la sesión una vez y la repite; si no se
 * puede renovar, avisa que la sesión terminó. Sin token (por ejemplo, en el ingreso) un 401 es solo
 * el error de esa petición.
 */
export async function solicitar<T>(
  ruta: string,
  opciones: RequestInit = {},
): Promise<Respuesta<T>> {
  const conToken = obtenerToken() !== null;
  try {
    return await pedir<T>(ruta, opciones);
  } catch (error) {
    if (!conToken || !esSesionRechazada(error) || ruta.startsWith(RUTAS_DE_SESION)) throw error;
    if (await renovarUnaVez()) return repetirTrasRenovar<T>(ruta, opciones);
    alRechazarSesion();
    throw error;
  }
}

/**
 * Llama a /api/v1/admin{ruta}: todas las rutas de la consola.
 */
export function solicitarAdmin<T>(ruta: string, opciones: RequestInit = {}): Promise<Respuesta<T>> {
  return solicitar<T>(`/admin${ruta}`, opciones);
}
