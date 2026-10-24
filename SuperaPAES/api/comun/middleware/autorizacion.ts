// Autorización por rol de cuenta interna (admin, docente). Se usa después de autenticarAdmin.
import type { RequestHandler } from 'express';
import { ErrorNoAutenticado, ErrorSinPermiso } from '../errores.js';
import type { RolCuentaInterna } from '../roles.js';

export function exigirRol(...roles: RolCuentaInterna[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.usuarioInterno) {
      next(new ErrorNoAutenticado());
      return;
    }
    next(roles.includes(req.usuarioInterno.rol) ? undefined : new ErrorSinPermiso());
  };
}

/** Marca una ruta que no pide sesión a propósito (ingreso, renovar y cerrar). No hace nada más. */
export const rutaPublica: RequestHandler = (_req, _res, next) => {
  next();
};
