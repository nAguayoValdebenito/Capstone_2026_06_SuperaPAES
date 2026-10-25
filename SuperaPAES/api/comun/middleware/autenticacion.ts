// Autenticación con JWT. La app (/api/v1/app) y la consola (/api/v1/admin) usan secretos, audiencias
// y emisores distintos, así que un token de una nunca sirve en la otra (RNF-01).
// Además de la firma, cada petición comprueba dos cosas, cada una con su dueño:
// - que la sesión del token (`sid`) siga abierta: cerrar la sesión lo deja sin efecto antes de su
//   vencimiento. La consulta es del módulo cuentas (dueño de app.token_sesion): `sesionVigente`.
// - en la consola, que la cuenta siga existiendo, activa y con el mismo rol (HU-03 esc. 3, CU-23 3.b):
//   un cambio de rol o una desactivación rige en la siguiente petición. La consulta es del módulo
//   administracion (dueño de usuario_interno): `verificarCuentaInterna`.
// app.ts entrega las dos funciones: comun/ no importa módulos.
// Emitir tokens (ingreso, renovación) es responsabilidad del módulo cuentas.
import type { Request, RequestHandler } from 'express';
import { ErrorNoAutenticado } from '../errores.js';
import {
  type Audiencia,
  type ClaimsAdmin,
  type ClaimsPorAudiencia,
  verificarToken,
} from '../jwt.js';
import type { Reloj } from '../reloj.js';
import type { RolCuentaInterna } from '../roles.js';

export interface SecretosJwt {
  secretoApp: string;
  secretoConsola: string;
}

/** Lo que el token dice de su sesión. */
export interface SesionDelToken {
  sub: string;
  sid: string;
  rol?: RolCuentaInterna;
}

/** Si la sesión del token sigue abierta y es de esa cuenta. */
export type ComprobarSesion = (audiencia: Audiencia, sesion: SesionDelToken) => Promise<boolean>;

/** Si la cuenta del token sigue existiendo, está activa y tiene ese mismo rol. */
export type VerificarCuentaInterna = (claims: ClaimsAdmin) => Promise<boolean>;

export interface OpcionesAutenticacion {
  reloj: Reloj;
  sesionVigente: ComprobarSesion;
  verificarCuentaInterna: VerificarCuentaInterna;
}

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

/** Cuando algo no sirve devuelve el mensaje de rechazo; si todo sirve, los datos del token. */
type Comprobacion<A extends Audiencia> = (
  token: string,
) => Promise<ClaimsPorAudiencia[A] | { rechazo: string }>;

function crearAutenticador<A extends Audiencia>(
  comprobar: Comprobacion<A>,
  asignar: (req: Request, claims: ClaimsPorAudiencia[A]) => void,
): RequestHandler {
  return (req, _res, next) => {
    const token = leerTokenBearer(req);
    if (!token) return next(new ErrorNoAutenticado());
    comprobar(token).then((resultado) => {
      if ('rechazo' in resultado) return next(new ErrorNoAutenticado(resultado.rechazo));
      asignar(req, resultado);
      next();
    }, next);
  };
}

export function crearAutenticacion(
  secretos: SecretosJwt,
  { reloj, sesionVigente, verificarCuentaInterna }: OpcionesAutenticacion,
): Autenticacion {
  const comprobarApp: Comprobacion<'app'> = async (token) => {
    const claims = await verificarToken('app', token, secretos.secretoApp, reloj());
    if (!claims || !(await sesionVigente('app', claims))) return { rechazo: SESION_INVALIDA };
    return claims;
  };
  // El rol del token se vuelve a comprobar en la base: un cambio de rol o una desactivación rige en
  // la siguiente petición, no cuando vence el token.
  const comprobarAdmin: Comprobacion<'admin'> = async (token) => {
    const claims = await verificarToken('admin', token, secretos.secretoConsola, reloj());
    if (!claims) return { rechazo: SESION_INVALIDA };
    // Dos consultas de módulos distintos y sin dependencia entre ellas: van en paralelo.
    const [sesionAbierta, cuentaVigente] = await Promise.all([
      sesionVigente('admin', claims),
      verificarCuentaInterna(claims),
    ]);
    if (!sesionAbierta) return { rechazo: SESION_INVALIDA };
    if (!cuentaVigente) return { rechazo: CUENTA_CAMBIADA };
    return claims;
  };
  return {
    autenticarApp: crearAutenticador(comprobarApp, (req, claims) => {
      req.estudiante = { id: claims.sub };
    }),
    autenticarAdmin: crearAutenticador(comprobarAdmin, (req, claims) => {
      req.usuarioInterno = { id: claims.sub, rol: claims.rol };
    }),
  };
}
