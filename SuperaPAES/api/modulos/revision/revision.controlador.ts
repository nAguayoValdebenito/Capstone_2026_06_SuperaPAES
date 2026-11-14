// Controlador del módulo revision: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores. Los parámetros ya vienen validados por validar().
import type { Request, RequestHandler } from 'express';
import type {
  ConsultaSeguimientoHttp,
  DatosCalibracion,
  DatosDesempate,
  DatosRevision,
} from './revision.validadores.js';
import { ErrorNoAutenticado } from '../../comun/errores.js';
import { responder } from '../../comun/respuesta.js';
import type { RevisionServicio } from './revision.servicio.js';

/** Manejador cuyo cuerpo y parámetros ya fueron validados y tipados por validar() en la ruta. */
type Validado<C = unknown> = RequestHandler<Record<string, string>, unknown, C>;

export interface RevisionControlador {
  enviarARevision: Validado;
  listarMisRevisiones: Validado;
  obtenerMiRevision: Validado;
  entregarRevision: Validado<DatosRevision>;
  listarDesempates: Validado;
  obtenerDesempate: Validado;
  entregarDesempate: Validado<DatosDesempate>;
  listarSeguimiento: RequestHandler;
  listarCalibracion: Validado;
  decidirCalibracion: Validado<DatosCalibracion>;
  listarConfirmadas: RequestHandler;
}

/**
 * Cuenta interna de la sesión: el administrador que envía la pregunta (queda en el historial y en la
 * auditoría) o el docente de la bandeja o del desempate. Lo deja autenticarAdmin.
 */
function usuarioDe(req: Request<Record<string, string>, unknown, unknown>): string {
  if (!req.usuarioInterno) throw new ErrorNoAutenticado();
  return req.usuarioInterno.id;
}

export function crearRevisionControlador(servicio: RevisionServicio): RevisionControlador {
  return {
    enviarARevision: async (req, res) => {
      const envio = await servicio.enviarARevision(usuarioDe(req), String(req.params.id));
      responder(res, envio, { estado: 201 });
    },
    listarMisRevisiones: async (req, res) => {
      responder(res, await servicio.listarMisRevisiones(usuarioDe(req)));
    },
    obtenerMiRevision: async (req, res) => {
      responder(res, await servicio.obtenerMiRevision(usuarioDe(req), String(req.params.id)));
    },
    entregarRevision: async (req, res) => {
      const entregada = await servicio.entregarRevision(
        usuarioDe(req),
        String(req.params.id),
        req.body,
      );
      responder(res, entregada, { estado: 201 });
    },
    listarDesempates: async (req, res) => {
      responder(res, await servicio.listarDesempates(usuarioDe(req)));
    },
    obtenerDesempate: async (req, res) => {
      responder(res, await servicio.obtenerDesempate(usuarioDe(req), String(req.params.id)));
    },
    entregarDesempate: async (req, res) => {
      const entregado = await servicio.entregarDesempate(
        usuarioDe(req),
        String(req.params.id),
        req.body,
      );
      responder(res, entregado, { estado: 201 });
    },
    listarSeguimiento: async (_req, res) => {
      const consulta = res.locals.consulta as ConsultaSeguimientoHttp;
      const { seguimiento, paginacion } = await servicio.listarSeguimiento(consulta);
      responder(res, seguimiento, { meta: paginacion });
    },
    ...manejadoresCalibracion(servicio),
  };
}

/** HU-26.1 y HU-26.2: la bandeja del docente, su decisión y las confirmadas para el administrador. */
function manejadoresCalibracion(
  servicio: RevisionServicio,
): Pick<RevisionControlador, 'listarCalibracion' | 'decidirCalibracion' | 'listarConfirmadas'> {
  return {
    listarConfirmadas: async (_req, res) => {
      const confirmadas = await servicio.listarConfirmadas();
      responder(res, confirmadas, { meta: { total: confirmadas.length } });
    },
    listarCalibracion: async (req, res) => {
      const bandeja = await servicio.listarCalibracion(usuarioDe(req));
      responder(res, bandeja, { meta: { total: bandeja.length } });
    },
    decidirCalibracion: async (req, res) => {
      const decision = await servicio.decidirCalibracion(
        usuarioDe(req),
        String(req.params.id),
        req.body,
      );
      responder(res, decision, { estado: 201 });
    },
  };
}
