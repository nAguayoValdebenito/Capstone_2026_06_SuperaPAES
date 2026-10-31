// Controlador del módulo suscripciones: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores.
import type { Request, RequestHandler } from 'express';
import type { Tienda } from '../../adaptadores/fabrica.js';
import { ErrorNoAutenticado } from '../../comun/errores.js';
import { responder } from '../../comun/respuesta.js';
import type { SuscripcionesServicio } from './suscripciones.servicio.js';
import type { DatosNuevaSuscripcion } from './suscripciones.validadores.js';

export interface SuscripcionesControlador {
  crearSuscripcion: RequestHandler<Record<string, string>, unknown, DatosNuevaSuscripcion>;
  avisoGooglePlay: RequestHandler;
  avisoAppStore: RequestHandler;
}

/** Estudiante de la sesión de la app. Lo deja la autenticación de /app. */
function estudianteDe(req: Request): string {
  if (!req.estudiante) throw new ErrorNoAutenticado();
  return req.estudiante.id;
}

export function crearSuscripcionesControlador(
  servicio: SuscripcionesServicio,
): SuscripcionesControlador {
  // El aviso se entrega con sus bytes originales: la verificación de la firma los necesita.
  const recibir =
    (tienda: Tienda): RequestHandler =>
    async (req, res) => {
      await servicio.recibirAviso(tienda, {
        cuerpoCrudo: req.cuerpoCrudo ?? Buffer.alloc(0),
        encabezados: req.headers,
      });
      responder(res, { recibido: true });
    };
  return {
    crearSuscripcion: async (req, res) => {
      const { suscripcion, creada } = await servicio.crearPendiente(estudianteDe(req), req.body);
      responder(res, suscripcion, { estado: creada ? 201 : 200 });
    },
    avisoGooglePlay: recibir('google_play'),
    avisoAppStore: recibir('app_store'),
  };
}
