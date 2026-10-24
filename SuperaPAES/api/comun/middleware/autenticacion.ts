// Autenticación con JWT. La app (/api/v1/app) y la consola (/api/v1/admin) usan secretos y
// audiencias distintos, así que un token de una nunca sirve en la otra.
// Emitir tokens (ingreso, renovación) es responsabilidad del módulo cuentas.
import type { Request, RequestHandler } from 'express';
import { ErrorNoAutenticado } from '../errores.js';
import { type ClaimsAdmin, verificarToken } from '../jwt.js';

export interface SecretosJwt {
  secretoApp: string;
  secretoConsola: string;
}

/**
 * Si la cuenta del token sigue existiendo, está activa y tiene ese mismo rol (HU-03 esc. 3, CU-23
 * 3.b). La entrega app.ts con el servicio de administracion: comun/ no importa módulos.
 */
export type VerificarCuentaInterna = (claims: ClaimsAdmin) => Promise<boolean>;

export interface Autenticacion {
  autenticarApp: RequestHandler;
  autenticarAdmin: RequestHandler;
}

const SESION_INVALIDA = 'La sesión no es válida o venció.';
const CUENTA_CAMBIADA = 'Tu cuenta cambió o fue desactivada. Vuelve a iniciar sesión.';

function leerTokenBearer(req: Request): string | null {
  const [esquema, token] = (req.headers.authorization ?? '').split(' ');
  return esquema?.toLowerCase() === 'bearer' && token ? token : null;
}

export function crearAutenticacion(
  secretos: SecretosJwt,
  verificarCuentaInterna: VerificarCuentaInterna,
): Autenticacion {
  return {
    autenticarApp: (req, _res, next) => {
      const token = leerTokenBearer(req);
      if (!token) return next(new ErrorNoAutenticado());
      verificarToken('app', token, secretos.secretoApp).then((claims) => {
        if (!claims) return next(new ErrorNoAutenticado(SESION_INVALIDA));
        req.estudiante = { id: claims.sub };
        next();
      }, next);
    },
    // El rol del token se vuelve a comprobar en la base: un cambio de rol o una desactivación rige
    // en la siguiente petición, no cuando vence el token.
    autenticarAdmin: (req, _res, next) => {
      const token = leerTokenBearer(req);
      if (!token) return next(new ErrorNoAutenticado());
      verificarToken('admin', token, secretos.secretoConsola)
        .then(async (claims) => {
          if (!claims) return next(new ErrorNoAutenticado(SESION_INVALIDA));
          if (!(await verificarCuentaInterna(claims))) {
            return next(new ErrorNoAutenticado(CUENTA_CAMBIADA));
          }
          req.usuarioInterno = { id: claims.sub, rol: claims.rol };
          next();
        })
        .catch(next);
    },
  };
}
