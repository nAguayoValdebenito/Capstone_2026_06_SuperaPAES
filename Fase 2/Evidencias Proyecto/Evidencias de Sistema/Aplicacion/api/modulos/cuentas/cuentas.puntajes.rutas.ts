// Rutas de los puntajes PAES declarados (HU-41.1, RN-16) en /api/v1/app/cuentas. Todas exigen la
// sesión de la app y responden el permiso con los puntajes, como los muestra A41.
import type { Request, RequestHandler, Router } from 'express';
import { ErrorNoAutenticado } from '../../comun/errores.js';
import type { MiddlewareRutas } from '../../comun/middleware/index.js';
import { validar } from '../../comun/middleware/validacion.js';
import { responder } from '../../comun/respuesta.js';
import type { CuentasServicio } from './cuentas.servicio.js';
import {
  type DatosPermisoPuntajes,
  type DatosPuntaje,
  esquemaIdPuntaje,
  esquemaPermisoPuntajes,
  esquemaPuntaje,
} from './cuentas.puntajes.validadores.js';

type ConCuerpo<C> = RequestHandler<Record<string, string>, unknown, C>;

function estudianteDe(req: Request<unknown, unknown, unknown>): string {
  if (!req.estudiante) throw new ErrorNoAutenticado();
  return req.estudiante.id;
}

export function montarPuntajes(
  router: Router,
  servicio: CuentasServicio,
  mw: MiddlewareRutas,
): void {
  const otorgar: ConCuerpo<DatosPermisoPuntajes> = async (req, res) => {
    responder(res, await servicio.otorgarPermisoPuntajes(estudianteDe(req), req.body.documentoId));
  };
  const guardar: ConCuerpo<DatosPuntaje> = async (req, res) => {
    responder(res, await servicio.guardarPuntaje(estudianteDe(req), req.body));
  };
  router.get('/puntajes', mw.autenticarApp, async (req, res) => {
    responder(res, await servicio.obtenerPuntajes(estudianteDe(req)));
  });
  router.put('/puntajes', mw.autenticarApp, validar({ cuerpo: esquemaPuntaje }), guardar);
  router.post(
    '/puntajes/permiso',
    mw.autenticarApp,
    validar({ cuerpo: esquemaPermisoPuntajes }),
    otorgar,
  );
  router.delete('/puntajes/permiso', mw.autenticarApp, async (req, res) => {
    responder(res, await servicio.retirarPermisoPuntajes(estudianteDe(req)));
  });
  router.delete(
    '/puntajes/:id',
    mw.autenticarApp,
    validar({ parametros: esquemaIdPuntaje }),
    async (req, res) => {
      responder(res, await servicio.borrarPuntaje(estudianteDe(req), Number(req.params.id)));
    },
  );
}
