// Autenticación con JWT. La app (/api/v1/app) y la consola (/api/v1/admin) usan secretos, audiencias
// y emisores distintos, así que un token de una nunca sirve en la otra (RNF-01).
// Además de la firma, cada petición comprueba dos cosas, cada una con su dueño:
// - que la sesión del token (`sid`) siga abierta: cerrar la sesión lo deja sin efecto antes de su
//   vencimiento. La consulta es del módulo cuentas (dueño de app.token_sesion): `sesionVigente`.
// - en la consola, que la cuenta siga existiendo, activa y con el mismo rol (HU-03 esc. 3, CU-23 3.b):
//   un cambio de rol o una desactivación rige en la siguiente petición. La consulta es del módulo
//   administracion (dueño de usuario_interno): `verificarCuentaInterna`. La misma consulta dice si la
//   cuenta aún tiene la contraseña que le asignó un administrador: entonces autenticarAdmin responde 403
//   CAMBIO_CONTRASENA_PENDIENTE, salvo en las rutas que usan autenticarAdminSinExigirCambio.
// app.ts entrega las dos funciones: comun/ no importa módulos.
// Emitir tokens (ingreso, renovación) es responsabilidad del módulo cuentas.
import type { Request, RequestHandler } from 'express';
import {
  type ErrorAplicacion,
  ErrorCambioContrasenaPendiente,
  ErrorNoAutenticado,
} from '../errores.js';
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

/**
 * Estado de la cuenta del token: `vigente` si existe, está activa y tiene ese mismo rol;
 * `cambio_pendiente` si además debe cambiar la contraseña que le asignó un administrador; si no,
 * `no_vigente`.
 */
export type EstadoCuentaInterna = 'vigente' | 'cambio_pendiente' | 'no_vigente';

export type VerificarCuentaInterna = (claims: ClaimsAdmin) => Promise<EstadoCuentaInterna>;

export interface OpcionesAutenticacion {
  reloj: Reloj;
  sesionVigente: ComprobarSesion;
  verificarCuentaInterna: VerificarCuentaInterna;
}

export interface Autenticacion {
  autenticarApp: RequestHandler;
  /** Sesión de la consola; con un cambio de contraseña pendiente responde 403. */
  autenticarAdmin: RequestHandler;
  /**
   * Igual que autenticarAdmin, pero deja pasar la cuenta que aún debe cambiar su contraseña. Solo para
   * /cuentas/yo y /cuentas/contrasena: lo que la consola necesita para pedir el cambio.
   */
  autenticarAdminSinExigirCambio: RequestHandler;
}

const SESION_INVALIDA = 'La sesión no es válida o venció.';
const CUENTA_CAMBIADA = 'Tu cuenta cambió o fue desactivada. Vuelve a iniciar sesión.';

function leerTokenBearer(req: Request): string | null {
  const [esquema, token] = (req.headers.authorization ?? '').split(' ');
  return esquema?.toLowerCase() === 'bearer' && token ? token : null;
}

/** Cuando algo no sirve devuelve el error de rechazo; si todo sirve, los datos del token. */
type Comprobacion<A extends Audiencia> = (
  token: string,
) => Promise<ClaimsPorAudiencia[A] | { rechazo: ErrorAplicacion }>;

const rechazar = (mensaje: string) => ({ rechazo: new ErrorNoAutenticado(mensaje) });

function crearAutenticador<A extends Audiencia>(
  comprobar: Comprobacion<A>,
  asignar: (req: Request, claims: ClaimsPorAudiencia[A]) => void,
): RequestHandler {
  return (req, _res, next) => {
    const token = leerTokenBearer(req);
    if (!token) return next(new ErrorNoAutenticado());
    comprobar(token).then((resultado) => {
      if ('rechazo' in resultado) return next(resultado.rechazo);
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
    if (!claims || !(await sesionVigente('app', claims))) return rechazar(SESION_INVALIDA);
    return claims;
  };
  // El rol del token se vuelve a comprobar en la base: un cambio de rol o una desactivación rige en
  // la siguiente petición, no cuando vence el token.
  const comprobarAdmin =
    (exigirCambio: boolean): Comprobacion<'admin'> =>
    async (token) => {
      const claims = await verificarToken('admin', token, secretos.secretoConsola, reloj());
      if (!claims) return rechazar(SESION_INVALIDA);
      // Dos consultas de módulos distintos y sin dependencia entre ellas: van en paralelo.
      const [sesionAbierta, estado] = await Promise.all([
        sesionVigente('admin', claims),
        verificarCuentaInterna(claims),
      ]);
      if (!sesionAbierta) return rechazar(SESION_INVALIDA);
      if (estado === 'no_vigente') return rechazar(CUENTA_CAMBIADA);
      if (estado === 'cambio_pendiente' && exigirCambio) {
        return { rechazo: new ErrorCambioContrasenaPendiente() };
      }
      return claims;
    };
  const asignarAdmin = (req: Request, claims: ClaimsAdmin) => {
    req.usuarioInterno = { id: claims.sub, rol: claims.rol, sid: claims.sid };
  };
  return {
    autenticarApp: crearAutenticador(comprobarApp, (req, claims) => {
      req.estudiante = { id: claims.sub };
    }),
    autenticarAdmin: crearAutenticador(comprobarAdmin(true), asignarAdmin),
    autenticarAdminSinExigirCambio: crearAutenticador(comprobarAdmin(false), asignarAdmin),
  };
}
