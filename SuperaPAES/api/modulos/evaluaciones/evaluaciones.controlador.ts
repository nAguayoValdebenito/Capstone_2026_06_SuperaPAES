// Controlador del módulo evaluaciones: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores.
import type { Request, RequestHandler } from 'express';
import { ErrorNoAutenticado } from '../../comun/errores.js';
import { responder } from '../../comun/respuesta.js';
import type { EvaluacionesServicio } from './evaluaciones.servicio.js';
import type { DatosInicioPractica, DatosRespuestaPregunta } from './evaluaciones.validadores.js';

export interface EvaluacionesControlador {
  iniciarMiniEnsayo: RequestHandler<Record<string, string>, unknown, { pruebaId: number }>;
  iniciarPractica: RequestHandler<Record<string, string>, unknown, DatosInicioPractica>;
  siguientePregunta: RequestHandler;
  cerrarPractica: RequestHandler;
  resumenPractica: RequestHandler;
  obtenerResultado: RequestHandler;
  obtenerRevision: RequestHandler;
  responderPregunta: RequestHandler<Record<string, string>, unknown, DatosRespuestaPregunta>;
  obtenerProgreso: RequestHandler;
  evaluacionAbierta: RequestHandler;
  entregarEvaluacion: RequestHandler;
}

function estudianteDe(req: Request): string {
  if (!req.estudiante) throw new ErrorNoAutenticado();
  return req.estudiante.id;
}

export function crearEvaluacionesControlador(
  servicio: EvaluacionesServicio,
): EvaluacionesControlador {
  return {
    entregarEvaluacion: async (req, res) => {
      responder(res, await servicio.entregarEvaluacion(estudianteDe(req), String(req.params.id)));
    },
    iniciarMiniEnsayo: async (req, res) => {
      responder(res, await servicio.iniciarMiniEnsayo(estudianteDe(req), req.body.pruebaId), {
        estado: 201,
      });
    },
    iniciarPractica: async (req, res) => {
      responder(res, await servicio.iniciarPractica(estudianteDe(req), req.body), { estado: 201 });
    },
    siguientePregunta: async (req, res) => {
      responder(res, await servicio.siguientePregunta(estudianteDe(req), String(req.params.id)));
    },
    cerrarPractica: async (req, res) => {
      responder(res, await servicio.cerrarPractica(estudianteDe(req), String(req.params.id)));
    },
    resumenPractica: async (req, res) => {
      responder(res, await servicio.resumenPractica(estudianteDe(req), String(req.params.id)));
    },
    obtenerResultado: async (req, res) => {
      responder(res, await servicio.obtenerResultado(estudianteDe(req), String(req.params.id)));
    },
    obtenerRevision: async (req, res) => {
      responder(res, await servicio.obtenerRevision(estudianteDe(req), String(req.params.id)));
    },
    responderPregunta: async (req, res) => {
      const datos = {
        evaluacionId: String(req.params.id),
        itemId: String(req.params.item),
        alternativaId: req.body.alternativaId,
      };
      responder(res, await servicio.responderPregunta(estudianteDe(req), datos));
    },
    obtenerProgreso: async (req, res) => {
      responder(res, await servicio.obtenerProgreso(estudianteDe(req)));
    },
    evaluacionAbierta: async (req, res) => {
      responder(res, await servicio.evaluacionAbierta(estudianteDe(req)));
    },
  };
}
