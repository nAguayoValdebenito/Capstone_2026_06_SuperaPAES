// Controlador del módulo temario: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores.
import type { RequestHandler } from 'express';
import { responder } from '../../comun/respuesta.js';
import type { TemarioServicio } from './temario.servicio.js';
import type { DatosOpcionesPractica } from './temario.validadores.js';

export interface TemarioControlador {
  listarAreas: RequestHandler;
  opcionesPerfil: RequestHandler;
  opcionesPractica: RequestHandler;
}

export function crearTemarioControlador(servicio: TemarioServicio): TemarioControlador {
  return {
    listarAreas: async (_req, res) => {
      responder(res, await servicio.listarAreas());
    },
    opcionesPerfil: async (_req, res) => {
      responder(res, await servicio.opcionesPerfil());
    },
    opcionesPractica: async (_req, res) => {
      // En Express 5 req.query es de solo lectura: validar() deja la consulta validada en res.locals.
      const { curso } = res.locals.consulta as DatosOpcionesPractica;
      responder(res, await servicio.opcionesPractica(curso));
    },
  };
}
