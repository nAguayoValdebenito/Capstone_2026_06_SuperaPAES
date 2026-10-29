// Controlador del módulo privacidad: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores.
import type { Request, RequestHandler } from 'express';
import { ErrorNoAutenticado } from '../../comun/errores.js';
import { responder } from '../../comun/respuesta.js';
import type { PrivacidadServicio } from './privacidad.servicio.js';

export interface PrivacidadControlador {
  exportarDatos: RequestHandler;
}

/** Estudiante de la sesión de la app. Lo deja la autenticación de /app. */
function estudianteDe(req: Request): string {
  if (!req.estudiante) throw new ErrorNoAutenticado();
  return req.estudiante.id;
}

export function crearPrivacidadControlador(servicio: PrivacidadServicio): PrivacidadControlador {
  return {
    exportarDatos: async (req, res) => {
      // Son datos personales: ni el navegador ni un proxy deben guardarlos.
      res.set('Cache-Control', 'no-store');
      responder(res, await servicio.exportarDatos(estudianteDe(req)));
    },
  };
}
