// Límite de intentos para ingreso, registro, recuperación de contraseña e invitaciones.
// Va al final de la cadena (autenticar → autorizar rol → validar → limitar), así solo cuentan los
// intentos bien formados. Detrás del proxy de Render la IP real llega por `trust proxy`.
// Los valores son de protección técnica, no parámetros de negocio (esos viven en contenido.configuracion).
import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { ErrorDemasiadosIntentos } from '../errores.js';

export interface OpcionesLimiteIntentos {
  ventanaMs: number;
  maximo: number;
}

export const LIMITE_INTENTOS_POR_DEFECTO: OpcionesLimiteIntentos = {
  ventanaMs: 15 * 60 * 1000,
  maximo: 10,
};

/** Cómo cuenta los intentos cada grupo de rutas. */
export interface UsoLimiteIntentos {
  /**
   * Solo cuentan las respuestas fallidas (4xx y 5xx). Para el ingreso: en un laboratorio o detrás
   * de CGNAT muchos estudiantes comparten una IP y sus ingresos correctos no deben bloquear a otros.
   * Registro, recuperación e invitaciones cuentan todo: ahí el abuso también tiene éxito.
   */
  soloFallidos?: boolean;
  /** Cuenta por estudiante autenticado (si lo hay) en vez de por IP. */
  porEstudiante?: boolean;
  /**
   * Cuenta por el correo del cuerpo ya validado en vez de por IP: frena a quien prueba contraseñas
   * de una cuenta desde muchas IP. El ingreso usa los dos límites, por IP y por correo (RNF-02).
   */
  porCorreo?: boolean;
}

/** Cada llamada crea un contador independiente: un límite por grupo de rutas. */
export type CrearLimiteIntentos = (uso?: UsoLimiteIntentos) => RequestHandler;

function correoDelCuerpo(req: Request): string | null {
  const cuerpo: unknown = req.body;
  if (typeof cuerpo !== 'object' || cuerpo === null || !('correo' in cuerpo)) return null;
  return typeof cuerpo.correo === 'string' ? cuerpo.correo : null;
}

function claveDe(req: Request, { porEstudiante, porCorreo }: UsoLimiteIntentos): string {
  if (porEstudiante && req.estudiante) return `estudiante:${req.estudiante.id}`;
  const correo = porCorreo ? correoDelCuerpo(req) : null;
  if (correo !== null) return `correo:${correo}`;
  // ipKeyGenerator agrupa las direcciones IPv6 por subred para que no se esquive el límite.
  return ipKeyGenerator(req.ip ?? '');
}

export function crearFabricaLimiteIntentos(opciones: OpcionesLimiteIntentos): CrearLimiteIntentos {
  return ({ soloFallidos = false, ...uso } = {}) =>
    rateLimit({
      windowMs: opciones.ventanaMs,
      limit: opciones.maximo,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skipSuccessfulRequests: soloFallidos,
      keyGenerator: (req) => claveDe(req, uso),
      handler: (_req, _res, next) => next(new ErrorDemasiadosIntentos()),
    });
}
