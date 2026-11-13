// Controlador del módulo privacidad: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores.
import type { Request, RequestHandler } from 'express';
import { ErrorNoAutenticado } from '../../comun/errores.js';
import { responder } from '../../comun/respuesta.js';
import type { PrivacidadServicio } from './privacidad.servicio.js';
import type {
  DatosAtencionSolicitud,
  DatosNuevaSolicitud,
  FiltrosSolicitudes,
} from './privacidad.validadores.js';

type ConCuerpo<C> = RequestHandler<Record<string, string>, unknown, C>;

export interface PrivacidadControlador {
  exportarDatos: RequestHandler;
  borrarCuenta: RequestHandler;
  estadoDeLaCuenta: RequestHandler;
  tiposDerecho: RequestHandler;
  crearSolicitud: ConCuerpo<DatosNuevaSolicitud>;
  misSolicitudes: RequestHandler;
  listarSolicitudes: RequestHandler;
  obtenerSolicitud: RequestHandler;
  atenderSolicitud: ConCuerpo<DatosAtencionSolicitud>;
}

/** Estudiante de la sesión de la app. Lo deja la autenticación de /app. */
function estudianteDe(req: Pick<Request, 'estudiante'>): string {
  if (!req.estudiante) throw new ErrorNoAutenticado();
  return req.estudiante.id;
}

/** Administrador de la sesión de la consola. Lo deja la autenticación de /admin. */
function administradorDe(req: Pick<Request, 'usuarioInterno'>): string {
  if (!req.usuarioInterno) throw new ErrorNoAutenticado();
  return req.usuarioInterno.id;
}

/** HU-55.1 (C14): la bandeja, una solicitud y su respuesta o rechazo. Tienen datos personales. */
function controladorConsola(
  servicio: PrivacidadServicio,
): Pick<PrivacidadControlador, 'listarSolicitudes' | 'obtenerSolicitud' | 'atenderSolicitud'> {
  return {
    listarSolicitudes: async (_req, res) => {
      res.set('Cache-Control', 'no-store');
      const { paginacion, ...bandeja } = await servicio.listarSolicitudes(
        res.locals.consulta as FiltrosSolicitudes,
      );
      responder(res, bandeja, { meta: paginacion });
    },
    obtenerSolicitud: async (req, res) => {
      res.set('Cache-Control', 'no-store');
      responder(res, await servicio.obtenerSolicitud(String(req.params.id)));
    },
    atenderSolicitud: async (req, res) => {
      const id = String(req.params.id);
      responder(res, await servicio.atenderSolicitud(administradorDe(req), id, req.body));
    },
  };
}

export function crearPrivacidadControlador(servicio: PrivacidadServicio): PrivacidadControlador {
  return {
    ...controladorConsola(servicio),
    exportarDatos: async (req, res) => {
      // Son datos personales: ni el navegador ni un proxy deben guardarlos.
      res.set('Cache-Control', 'no-store');
      responder(res, await servicio.exportarDatos(estudianteDe(req)));
    },
    borrarCuenta: async (req, res) => {
      responder(res, await servicio.borrarCuenta(estudianteDe(req)));
    },
    estadoDeLaCuenta: async (req, res) => {
      responder(res, await servicio.estadoDeLaCuenta(estudianteDe(req)));
    },
    tiposDerecho: async (_req, res) => {
      responder(res, await servicio.tiposDerecho());
    },
    crearSolicitud: async (req, res) => {
      responder(res, await servicio.crearSolicitud(estudianteDe(req), req.body), { estado: 201 });
    },
    misSolicitudes: async (req, res) => {
      // Pueden traer datos personales en el detalle o la respuesta.
      res.set('Cache-Control', 'no-store');
      responder(res, await servicio.solicitudesDe(estudianteDe(req)));
    },
  };
}
