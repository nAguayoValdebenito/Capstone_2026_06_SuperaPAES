// Autenticación con JWT. La app (/api/v1/app) y la consola (/api/v1/admin) usan secretos y
// audiencias distintos, así que un token de una nunca sirve en la otra.
// Emitir tokens (ingreso, renovación) es responsabilidad del módulo cuentas.
import type { Request, RequestHandler } from 'express';
import { ErrorNoAutenticado } from '../errores.js';
import { verificarToken } from '../jwt.js';

export interface SecretosJwt {
  secretoApp: string;
  secretoConsola: string;
}

export interface Autenticacion {
  autenticarApp: RequestHandler;
  autenticarAdmin: RequestHandler;
}

function leerTokenBearer(req: Request): string | null {
  const [esquema, token] = (req.headers.authorization ?? '').split(' ');
  return esquema?.toLowerCase() === 'bearer' && token ? token : null;
}

export function crearAutenticacion(secretos: SecretosJwt): Autenticacion {
  return {
    autenticarApp: (req, _res, next) => {
      const token = leerTokenBearer(req);
      if (!token) return next(new ErrorNoAutenticado());
      verificarToken('app', token, secretos.secretoApp).then((claims) => {
        if (!claims) return next(new ErrorNoAutenticado('La sesión no es válida o venció.'));
        req.estudiante = { id: claims.sub };
        next();
      }, next);
    },
    autenticarAdmin: (req, _res, next) => {
      const token = leerTokenBearer(req);
      if (!token) return next(new ErrorNoAutenticado());
      verificarToken('admin', token, secretos.secretoConsola).then((claims) => {
        if (!claims) return next(new ErrorNoAutenticado('La sesión no es válida o venció.'));
        req.usuarioInterno = { id: claims.sub, rol: claims.rol };
        next();
      }, next);
    },
  };
}
