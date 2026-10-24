// Autenticación con JWT. La app (/api/v1/app) y la consola (/api/v1/admin) usan secretos, audiencias
// y emisores distintos, así que un token de una nunca sirve en la otra (RNF-01).
// Además de la firma, cada petición comprueba que la sesión del token (`sid`) siga abierta: cerrar
// la sesión o desactivar la cuenta deja el token sin efecto antes de su vencimiento. Esa consulta la
// hace el módulo cuentas (dueño de app.token_sesion); app.ts la entrega como `sesionVigente`.
// Emitir tokens (ingreso, renovación) es responsabilidad del módulo cuentas.
import type { Request, RequestHandler } from 'express';
import { ErrorNoAutenticado } from '../errores.js';
import { type Audiencia, type ClaimsPorAudiencia, verificarToken } from '../jwt.js';
import type { Reloj } from '../reloj.js';
import type { RolCuentaInterna } from '../roles.js';

export interface SecretosJwt {
  secretoApp: string;
  secretoConsola: string;
}

/** Lo que el token dice de su sesión. En la consola también el rol, que debe seguir vigente. */
export interface SesionDelToken {
  sub: string;
  sid: string;
  rol?: RolCuentaInterna;
}

/** Si la sesión sigue abierta y su cuenta puede usarla (activa y con el mismo rol). */
export type ComprobarSesion = (audiencia: Audiencia, sesion: SesionDelToken) => Promise<boolean>;

export interface OpcionesAutenticacion {
  reloj: Reloj;
  sesionVigente: ComprobarSesion;
}

export interface Autenticacion {
  autenticarApp: RequestHandler;
  autenticarAdmin: RequestHandler;
}

function leerTokenBearer(req: Request): string | null {
  const [esquema, token] = (req.headers.authorization ?? '').split(' ');
  return esquema?.toLowerCase() === 'bearer' && token ? token : null;
}

function crearAutenticador<A extends Audiencia>(
  audiencia: A,
  secreto: string,
  { reloj, sesionVigente }: OpcionesAutenticacion,
  asignar: (req: Request, claims: ClaimsPorAudiencia[A]) => void,
): RequestHandler {
  const verificar = async (token: string) => {
    const claims = await verificarToken(audiencia, token, secreto, reloj());
    return claims && (await sesionVigente(audiencia, claims)) ? claims : null;
  };
  return (req, _res, next) => {
    const token = leerTokenBearer(req);
    if (!token) return next(new ErrorNoAutenticado());
    verificar(token).then((claims) => {
      if (!claims) return next(new ErrorNoAutenticado('La sesión no es válida o venció.'));
      asignar(req, claims);
      next();
    }, next);
  };
}

export function crearAutenticacion(
  secretos: SecretosJwt,
  opciones: OpcionesAutenticacion,
): Autenticacion {
  return {
    autenticarApp: crearAutenticador('app', secretos.secretoApp, opciones, (req, claims) => {
      req.estudiante = { id: claims.sub };
    }),
    autenticarAdmin: crearAutenticador(
      'admin',
      secretos.secretoConsola,
      opciones,
      (req, claims) => {
        req.usuarioInterno = { id: claims.sub, rol: claims.rol };
      },
    ),
  };
}
