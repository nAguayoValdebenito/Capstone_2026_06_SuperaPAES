import type { RequestHandler } from 'express';
import { ErrorNoAutenticado } from '../../comun/errores.js';
import { responder } from '../../comun/respuesta.js';
import type { PlanesServicio } from './suscripciones.planes.servicio.js';
import type { DatosEditarPlan } from './suscripciones.planes.validadores.js';

export function crearPlanesControlador(
  servicio: PlanesServicio,
): Record<'listar' | 'editar', RequestHandler> {
  return {
    listar: async (_req, res) => {
      responder(res, await servicio.listarPlanes());
    },
    editar: async (req, res) => {
      if (!req.usuarioInterno) throw new ErrorNoAutenticado();
      const datos = req.body as DatosEditarPlan;
      responder(
        res,
        await servicio.editarPlan(req.usuarioInterno.id, Number(req.params.id), datos),
      );
    },
  };
}
