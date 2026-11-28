import type { RequestHandler } from 'express';
import { responder } from '../../comun/respuesta.js';
import { ErrorNoAutenticado } from '../../comun/errores.js';
import type { SaldoDocenteServicio } from './revision.saldo.servicio.js';
import type { ConsultaSaldo, NuevaTarifa } from './revision.saldo.validadores.js';

export function crearSaldoControlador(
  servicio: SaldoDocenteServicio,
): Record<'miSaldo' | 'saldoDocente' | 'tarifas' | 'registrarTarifa', RequestHandler> {
  return {
    miSaldo: async (req, res) => {
      if (!req.usuarioInterno) throw new ErrorNoAutenticado();
      const { paginacion, ...saldo } = await servicio.consultarSaldo(
        req.usuarioInterno.id,
        res.locals.consulta as ConsultaSaldo,
      );
      responder(res, saldo, { meta: paginacion });
    },
    saldoDocente: async (req, res) => {
      const { paginacion, ...saldo } = await servicio.consultarSaldo(
        String(req.params.docenteId),
        res.locals.consulta as ConsultaSaldo,
      );
      responder(res, saldo, { meta: paginacion });
    },
    tarifas: async (_req, res) => responder(res, await servicio.consultarTarifas()),
    registrarTarifa: async (req, res) => {
      if (!req.usuarioInterno) throw new ErrorNoAutenticado();
      responder(
        res,
        await servicio.registrarTarifa(req.usuarioInterno.id, req.body as NuevaTarifa),
        { estado: 201 },
      );
    },
  };
}
