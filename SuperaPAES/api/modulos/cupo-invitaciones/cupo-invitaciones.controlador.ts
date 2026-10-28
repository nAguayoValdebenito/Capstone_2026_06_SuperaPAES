// Controlador del módulo cupo-invitaciones: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores.
import type { RequestHandler } from 'express';
import { ErrorNoAutenticado } from '../../comun/errores.js';
import { responder } from '../../comun/respuesta.js';
import type { CupoInvitacionesServicio } from './cupo-invitaciones.servicio.js';
import type { DatosCodigoInvitacion } from './cupo-invitaciones.validadores.js';

export interface CupoInvitacionesControlador {
  registrarCodigo: RequestHandler<Record<string, string>, unknown, DatosCodigoInvitacion>;
  cupoDeHoy: RequestHandler;
}

export function crearCupoInvitacionesControlador(
  servicio: CupoInvitacionesServicio,
): CupoInvitacionesControlador {
  return {
    registrarCodigo: async (req, res) => {
      if (!req.estudiante) throw new ErrorNoAutenticado();
      const { codigo } = req.body;
      await servicio.registrarCodigoInvitacion(req.estudiante.id, codigo);
      responder(res, { registrado: true }, { estado: 201 });
    },
    cupoDeHoy: async (req, res) => {
      if (!req.estudiante) throw new ErrorNoAutenticado();
      responder(res, await servicio.cupoDeHoy(req.estudiante.id));
    },
  };
}
