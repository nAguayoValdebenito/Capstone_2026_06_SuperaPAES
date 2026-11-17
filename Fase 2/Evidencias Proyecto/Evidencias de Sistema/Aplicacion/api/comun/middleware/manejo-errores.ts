// Convierte cualquier error en la respuesta con el formato común
// { data: null, error: { codigo, mensaje, detalles? }, meta: null }.
import type { ErrorRequestHandler, RequestHandler } from 'express';
import {
  ErrorAplicacion,
  ErrorCuerpoDemasiadoGrande,
  ErrorNoEncontrado,
  ErrorSolicitudInvalida,
} from '../errores.js';
import { registro } from '../registro.js';
import { cuerpoDeError } from '../respuesta.js';

export const rutaNoEncontrada: RequestHandler = (_req, _res, next) => {
  next(new ErrorNoEncontrado('La ruta solicitada no existe.'));
};

export const manejarErrores: ErrorRequestHandler = (error: unknown, req, res, next) => {
  // Si la respuesta ya empezó, solo Express puede cortarla.
  if (res.headersSent) {
    next(error);
    return;
  }
  const errorAplicacion = convertir(error);
  if (errorAplicacion.estadoHttp >= 500) {
    // El detalle técnico solo va al registro del servidor, nunca al cliente.
    const causa = errorAplicacion === error ? errorAplicacion.cause : error;
    registro.error(errorAplicacion.message, {
      metodo: req.method,
      ruta: req.path,
      codigo: errorAplicacion.codigo,
      causa: causa instanceof Error ? (causa.stack ?? causa.message) : causa,
    });
  }
  res.status(errorAplicacion.estadoHttp).json(cuerpoDeError(errorAplicacion));
};

/** Datos que agrega el lector del cuerpo de Express (body-parser) a sus errores. */
interface ErrorDeCuerpo {
  type?: unknown;
  status?: unknown;
}

function esErrorDeCuerpo(valor: unknown): valor is ErrorDeCuerpo {
  return typeof valor === 'object' && valor !== null;
}

function convertir(error: unknown): ErrorAplicacion {
  if (error instanceof ErrorAplicacion) return error;
  // Errores que lanza el lector del cuerpo de Express (body-parser).
  const { type: tipo, status: estado }: ErrorDeCuerpo = esErrorDeCuerpo(error) ? error : {};
  if (tipo === 'entity.parse.failed') {
    return new ErrorSolicitudInvalida('El cuerpo JSON no es válido.');
  }
  if (tipo === 'entity.too.large') return new ErrorCuerpoDemasiadoGrande();
  // Otros errores del cliente al leer el cuerpo (charset o codificación no soportados, cuerpo cortado).
  if (typeof estado === 'number' && estado >= 400 && estado < 500) {
    return new ErrorAplicacion(
      estado,
      'SOLICITUD_INVALIDA',
      'No se pudo leer el cuerpo de la solicitud.',
    );
  }
  return new ErrorAplicacion(500, 'ERROR_INTERNO', 'Ocurrió un error inesperado.');
}
