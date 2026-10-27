// Controlador del módulo evaluaciones: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores.
import type { Request, RequestHandler } from 'express';
import { ErrorNoAutenticado } from '../../comun/errores.js';
import { responder } from '../../comun/respuesta.js';
import type { EvaluacionesServicio } from './evaluaciones.servicio.js';
import type { DatosInicioPractica } from './evaluaciones.validadores.js';

export interface EvaluacionesControlador {
  iniciarPractica: RequestHandler<Record<string, string>, unknown, DatosInicioPractica>;
  siguientePregunta: RequestHandler;
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
  };
}
