// Controlador del módulo revision: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores.
import type { RequestHandler } from 'express';
import { responder } from '../../comun/respuesta.js';
import type { RevisionServicio } from './revision.servicio.js';

export interface RevisionControlador {
  listarMisRevisiones: RequestHandler;
  listarDesempates: RequestHandler;
  listarSeguimiento: RequestHandler;
}

export function crearRevisionControlador(servicio: RevisionServicio): RevisionControlador {
  return {
    listarMisRevisiones: async (_req, res) => {
      responder(res, await servicio.listarMisRevisiones());
    },
    listarDesempates: async (_req, res) => {
      responder(res, await servicio.listarDesempates());
    },
    listarSeguimiento: async (_req, res) => {
      responder(res, await servicio.listarSeguimiento());
    },
  };
}
