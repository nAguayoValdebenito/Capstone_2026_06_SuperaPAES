// Controlador del módulo revision: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores. Los parámetros ya vienen validados por validar().
import type { Request, RequestHandler } from 'express';
import { ErrorNoAutenticado } from '../../comun/errores.js';
import { responder } from '../../comun/respuesta.js';
import type { RevisionServicio } from './revision.servicio.js';

export interface RevisionControlador {
  enviarARevision: RequestHandler;
  listarMisRevisiones: RequestHandler;
  listarDesempates: RequestHandler;
  listarSeguimiento: RequestHandler;
}

/** Administrador que envía la pregunta: queda en el historial y en la auditoría. Lo deja autenticarAdmin. */
function administradorDe(req: Request): string {
  if (!req.usuarioInterno) throw new ErrorNoAutenticado();
  return req.usuarioInterno.id;
}

export function crearRevisionControlador(servicio: RevisionServicio): RevisionControlador {
  return {
    enviarARevision: async (req, res) => {
      const envio = await servicio.enviarARevision(administradorDe(req), String(req.params.id));
      responder(res, envio, { estado: 201 });
    },
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
