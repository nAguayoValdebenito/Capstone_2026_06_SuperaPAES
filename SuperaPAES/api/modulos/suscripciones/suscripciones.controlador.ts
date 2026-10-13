// Controlador del módulo suscripciones: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores.
import type { RequestHandler } from 'express';
import type { Tienda } from '../../adaptadores/fabrica.js';
import { responder } from '../../comun/respuesta.js';
import type { SuscripcionesServicio } from './suscripciones.servicio.js';

export interface SuscripcionesControlador {
  avisoGooglePlay: RequestHandler;
  avisoAppStore: RequestHandler;
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
    avisoGooglePlay: recibir('google_play'),
    avisoAppStore: recibir('app_store'),
  };
}
