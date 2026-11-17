// Controlador de la trazabilidad de suscripciones en la consola (HU-56, C16): traduce HTTP a llamadas
// del servicio y responde con responder(). Sin SQL.
import type { RequestHandler } from 'express';
import { responder } from '../../comun/respuesta.js';
import type { TrazabilidadServicio } from './suscripciones.trazabilidad.servicio.js';
import type {
  ConsultaAvisos,
  FiltrosSuscripciones,
} from './suscripciones.trazabilidad.validadores.js';

export interface TrazabilidadControlador {
  resumen: RequestHandler;
  listar: RequestHandler;
  detalle: RequestHandler;
  avisosConError: RequestHandler;
}

export function crearTrazabilidadControlador(
  servicio: TrazabilidadServicio,
): TrazabilidadControlador {
  return {
    resumen: async (_req, res) => {
      responder(res, await servicio.resumenSuscripciones());
    },
    listar: async (_req, res) => {
      // En Express 5 req.query es de solo lectura: validar() deja la consulta validada en res.locals.
      const filtros = res.locals.consulta as FiltrosSuscripciones;
      const { suscripciones, paginacion } = await servicio.listarSuscripciones(filtros);
      responder(res, suscripciones, { meta: paginacion });
    },
    detalle: async (req, res) => {
      responder(res, await servicio.detalleSuscripcion(String(req.params.id)));
    },
    avisosConError: async (_req, res) => {
      const { avisos, paginacion } = await servicio.avisosConError(
        res.locals.consulta as ConsultaAvisos,
      );
      responder(res, avisos, { meta: paginacion });
    },
  };
}
