// Cliente HTTP de la consola sobre fetch: URL base, token de sesión y formato { data, error, meta }.
// La consola habla con /api/v1/admin (solicitarAdmin); /api/v1/salud es la única ruta fuera de admin.
import type { CuerpoRespuesta } from '../tipos';

// La API local solo se usa por defecto en desarrollo. En producción VITE_API_URL es obligatoria.
const URL_BASE = (
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3000' : '')
).replace(/\/$/, '');

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

/**
 * Lo configurará el estado de sesión cuando exista el ingreso real.
 */
export function configurarToken(fuente: () => string | null): void {
  obtenerToken = fuente;
}

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

/** Llama a /api/v1{ruta} y devuelve `data` y `meta`, o lanza ErrorApi con el error de la API. */
export async function solicitar<T>(
  ruta: string,
  opciones: RequestInit = {},
): Promise<Respuesta<T>> {
  const cuerpo = await leerCuerpo(await enviar(ruta, opciones));
  return { data: cuerpo.data as T, meta: cuerpo.meta };
}

/**
 * Llama a /api/v1/admin{ruta}: todas las rutas de la consola.
 */
export function solicitarAdmin<T>(ruta: string, opciones: RequestInit = {}): Promise<Respuesta<T>> {
  return solicitar<T>(`/admin${ruta}`, opciones);
}
