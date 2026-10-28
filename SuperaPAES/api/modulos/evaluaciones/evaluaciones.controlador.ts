// Controlador del módulo evaluaciones: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores.
import type { Request, RequestHandler } from 'express';
import { ErrorNoAutenticado } from '../../comun/errores.js';
import { responder } from '../../comun/respuesta.js';
import type { EvaluacionesServicio } from './evaluaciones.servicio.js';
import type { DatosInicioPractica, DatosRespuestaPregunta } from './evaluaciones.validadores.js';

export interface EvaluacionesControlador {
  iniciarPractica: RequestHandler<Record<string, string>, unknown, DatosInicioPractica>;
  siguientePregunta: RequestHandler;
  cerrarPractica: RequestHandler;
  resumenPractica: RequestHandler;
  responderPregunta: RequestHandler<Record<string, string>, unknown, DatosRespuestaPregunta>;
  obtenerProgreso: RequestHandler;
}

function estudianteDe(req: Request): string {
  if (!req.estudiante) throw new ErrorNoAutenticado();
  return req.estudiante.id;
}

export function crearEvaluacionesControlador(
  servicio: EvaluacionesServicio,
): EvaluacionesControlador {
  return {
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
  };
}
