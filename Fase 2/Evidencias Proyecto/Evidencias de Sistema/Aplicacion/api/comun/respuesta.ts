// Formato único de respuesta de la API: { data, error, meta }.
// Los controladores responden con `responder`; los errores los arma el middleware central.
import type { Response } from 'express';
import type { ErrorAplicacion } from './errores.js';
import { CAMPOS_ID_POR_RUTA, serializarIds } from './ids-respuesta.js';

/** Paginación de un listado, en `meta`. */
export interface Paginacion {
  pagina: number;
  porPagina: number;
  total: number;
}

export interface DetalleError {
  codigo: string;
  mensaje: string;
  detalles?: unknown;
}

export interface CuerpoRespuesta<T> {
  data: T | null;
  error: DetalleError | null;
  meta: Paginacion | Record<string, unknown> | null;
}

export function responder<T>(
  res: Response,
  data: T,
  opciones: { estado?: number; meta?: CuerpoRespuesta<T>['meta'] } = {},
): void {
  const patron = (res.req.route as { path?: unknown } | undefined)?.path;
  const ruta = `${res.req.method} ${res.req.baseUrl}${typeof patron === 'string' ? patron : ''}`;
  const cuerpo: CuerpoRespuesta<T> = {
    data: serializarIds(data, CAMPOS_ID_POR_RUTA[ruta] ?? []),
    error: null,
    meta: opciones.meta ?? null,
  };
  res.status(opciones.estado ?? 200).json(cuerpo);
}

export function cuerpoDeError(error: ErrorAplicacion): CuerpoRespuesta<never> {
  return {
    data: null,
    error: {
      codigo: error.codigo,
      mensaje: error.message,
      ...(error.detalles === undefined ? {} : { detalles: error.detalles }),
    },
    meta: null,
  };
}
