// Controlador del módulo generador: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores.
import type { Request, RequestHandler } from 'express';
import { ErrorNoAutenticado } from '../../comun/errores.js';
import { responder } from '../../comun/respuesta.js';
import type { GeneradorServicio } from './generador.servicio.js';
import type { DatosNuevoLoteHttp } from './generador.tipos.js';
import type { ConsultaLotes } from './generador.validadores.js';

type Validado<T = unknown> = RequestHandler<Record<string, string>, unknown, T>;

export interface GeneradorControlador {
  crearLote: Validado<DatosNuevoLoteHttp>;
  obtenerLote: Validado;
  listarLotes: RequestHandler;
  usoDeLaIa: RequestHandler;
}

/** Administrador que pide el lote: queda como solicitante y en la auditoría. Lo deja autenticarAdmin. */
function solicitanteDe(req: Request<Record<string, string>, unknown, unknown>): string {
  if (!req.usuarioInterno) throw new ErrorNoAutenticado();
  return req.usuarioInterno.id;
}

export function crearGeneradorControlador(servicio: GeneradorServicio): GeneradorControlador {
  return {
    // 202: quedó en la cola; 200: ya había un pedido idéntico pendiente y se devuelve ese.
    crearLote: async (req, res) => {
      const { lote, creado } = await servicio.crearLote(solicitanteDe(req), req.body);
      responder(res, lote, { estado: creado ? 202 : 200 });
    },
    obtenerLote: async (req, res) => {
      responder(res, await servicio.obtenerLote(String(req.params.id)));
    },
    usoDeLaIa: async (_req, res) => {
      responder(res, await servicio.usoDeLaIa());
    },
    listarLotes: async (_req, res) => {
      // En Express 5 req.query es de solo lectura: validar() deja la consulta validada en res.locals.
      const { pagina, porPagina } = res.locals.consulta as ConsultaLotes;
      const { lotes, paginacion } = await servicio.listarLotes(pagina, porPagina);
      responder(res, lotes, { meta: paginacion });
    },
  };
}
