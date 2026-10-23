// Controlador del módulo temario: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores.
import type { RequestHandler } from 'express';
import { responder } from '../../comun/respuesta.js';
import type { TemarioServicio } from './temario.servicio.js';

export interface TemarioControlador {
  listarAreas: RequestHandler;
}

export function crearTemarioControlador(servicio: TemarioServicio): TemarioControlador {
  return {
    listarAreas: async (_req, res) => {
      responder(res, await servicio.listarAreas());
    },
  };
}
