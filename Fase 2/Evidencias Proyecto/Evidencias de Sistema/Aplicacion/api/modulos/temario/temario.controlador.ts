// Controlador del módulo temario: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores.
import type { RequestHandler } from 'express';
import { ErrorNoAutenticado } from '../../comun/errores.js';
import { responder } from '../../comun/respuesta.js';
import type { TemarioServicio } from './temario.servicio.js';
import type { DatosMezclaDificultad, DatosOpcionesPractica } from './temario.validadores.js';

export interface TemarioControlador {
  consultarTemario: RequestHandler;
  consultarListasOpciones: RequestHandler;
  editarMezclaDificultad: RequestHandler<Record<string, string>, unknown, DatosMezclaDificultad>;
  listarAreas: RequestHandler;
  opcionesPerfil: RequestHandler;
  opcionesPractica: RequestHandler;
}

export function crearTemarioControlador(servicio: TemarioServicio): TemarioControlador {
  return {
    consultarTemario: async (_req, res) => {
      responder(res, await servicio.consultarTemario());
    },
    consultarListasOpciones: async (_req, res) => {
      responder(res, await servicio.consultarListasOpciones());
    },
    editarMezclaDificultad: async (req, res) => {
      if (!req.usuarioInterno) throw new ErrorNoAutenticado();
      const { dificultades } = req.body;
      responder(res, await servicio.editarMezclaDificultad(req.usuarioInterno.id, dificultades));
    },
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
