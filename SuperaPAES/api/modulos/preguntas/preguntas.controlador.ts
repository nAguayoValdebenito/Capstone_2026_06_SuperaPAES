// Controlador del módulo preguntas: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores. La consulta ya viene validada por validar() en las rutas.
import type { RequestHandler } from 'express';
import { responder } from '../../comun/respuesta.js';
import type { PreguntasServicio } from './preguntas.servicio.js';
import type { FiltrosBanco } from './preguntas.validadores.js';

export interface PreguntasControlador {
  listarBanco: RequestHandler;
  filtrosDelBanco: RequestHandler;
}

export function crearPreguntasControlador(servicio: PreguntasServicio): PreguntasControlador {
  return {
    listarBanco: async (_req, res) => {
      // En Express 5 req.query es de solo lectura: validar() deja la consulta validada en res.locals.
      const filtros = res.locals.consulta as FiltrosBanco;
      const { preguntas, paginacion } = await servicio.listarBanco(filtros);
      responder(res, preguntas, { meta: paginacion });
    },
    filtrosDelBanco: async (_req, res) => {
      responder(res, await servicio.filtrosDelBanco());
    },
  };
}
