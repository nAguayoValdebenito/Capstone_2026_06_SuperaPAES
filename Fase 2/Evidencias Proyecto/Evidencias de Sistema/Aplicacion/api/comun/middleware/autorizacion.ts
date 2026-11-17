// Autorización por rol de cuenta interna (admin, docente). Se usa después de autenticarAdmin.
// Cada ruta de /api/v1/admin declara su permiso en su propia cadena (DAS 4.3.3): exigirRol(...) o,
// solo para el ingreso y la sesión, rutaPublica. La prueba de inventario (pruebas/permisos.test.ts)
// recorre las rutas y falla si alguna no lo declara.
import type { RequestHandler } from 'express';
import { ErrorNoAutenticado, ErrorSinPermiso } from '../errores.js';
import type { RolCuentaInterna } from '../roles.js';

type Permiso = readonly RolCuentaInterna[] | 'publica';

const permisos = new WeakMap<RequestHandler, Permiso>();

export function exigirRol(...roles: RolCuentaInterna[]): RequestHandler {
  const middleware: RequestHandler = (req, _res, next) => {
    if (!req.usuarioInterno) {
      next(new ErrorNoAutenticado());
      return;
    }
    next(roles.includes(req.usuarioInterno.rol) ? undefined : new ErrorSinPermiso());
  };
  permisos.set(middleware, roles);
  return middleware;
}

/** Marca una ruta que no pide sesión a propósito (ingreso, renovar y cerrar). No hace nada más. */
export const rutaPublica: RequestHandler = (_req, _res, next) => {
  next();
};
permisos.set(rutaPublica, 'publica');

/** Permiso que declara un middleware de la cadena, o undefined si no es exigirRol ni rutaPublica. */
export function permisoDeclarado(manejador: unknown): Permiso | undefined {
  return typeof manejador === 'function' ? permisos.get(manejador as RequestHandler) : undefined;
}
