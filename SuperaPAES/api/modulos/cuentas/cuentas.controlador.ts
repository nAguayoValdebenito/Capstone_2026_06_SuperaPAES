// Controlador del módulo cuentas: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores. El cuerpo ya viene validado por validar() en las rutas.
import type { RequestHandler } from 'express';
import { ErrorNoAutenticado } from '../../comun/errores.js';
import { responder } from '../../comun/respuesta.js';
import type { CuentasServicio } from './cuentas.servicio.js';
import type {
  Credenciales,
  CredencialesApp,
  DatosRecuperacion,
  DatosRegistro,
  DatosTokenRenovacion,
} from './cuentas.validadores.js';

/** Manejador cuyo cuerpo ya fue validado y tipado por validar() en la ruta. */
type ConCuerpo<C> = RequestHandler<Record<string, string>, unknown, C>;

export interface CuentasControlador {
  registrar: ConCuerpo<DatosRegistro>;
  ingresar: ConCuerpo<CredencialesApp>;
  renovarApp: ConCuerpo<DatosTokenRenovacion>;
  cerrarApp: ConCuerpo<DatosTokenRenovacion>;
  solicitarRecuperacion: ConCuerpo<DatosRecuperacion>;
  ingresarConsola: ConCuerpo<Credenciales>;
  renovarConsola: ConCuerpo<DatosTokenRenovacion>;
  cerrarConsola: ConCuerpo<DatosTokenRenovacion>;
  usuarioConsola: RequestHandler;
}

export function crearCuentasControlador(servicio: CuentasServicio): CuentasControlador {
  return {
    registrar: async (req, res) => {
      responder(res, await servicio.registrarEstudiante(req.body), {
        estado: 201,
      });
    },
    ingresar: async (req, res) => {
      responder(res, await servicio.ingresarEstudiante(req.body));
    },
    renovarApp: async (req, res) => {
      responder(res, await servicio.renovarSesion('app', req.body.tokenRenovacion));
    },
    cerrarApp: async (req, res) => {
      // Siempre la misma respuesta, aunque la sesión ya estuviera cerrada o vencida.
      await servicio.cerrarSesion('app', req.body.tokenRenovacion);
      responder(res, { sesionCerrada: true });
    },
    solicitarRecuperacion: async (req, res) => {
      // Siempre la misma respuesta, exista o no la cuenta, para no revelar qué correos están registrados.
      await servicio.solicitarRecuperacion(req.body.correo);
      responder(res, { enviado: true }, { estado: 202 });
    },
    ingresarConsola: async (req, res) => {
      responder(res, await servicio.ingresarUsuarioInterno(req.body));
    },
    renovarConsola: async (req, res) => {
      responder(res, await servicio.renovarSesion('admin', req.body.tokenRenovacion));
    },
    cerrarConsola: async (req, res) => {
      // Siempre la misma respuesta, aunque la sesión ya estuviera cerrada o vencida.
      await servicio.cerrarSesion('admin', req.body.tokenRenovacion);
      responder(res, { sesionCerrada: true });
    },
    usuarioConsola: async (req, res) => {
      if (!req.usuarioInterno) throw new ErrorNoAutenticado();
      responder(res, await servicio.obtenerUsuarioConsola(req.usuarioInterno.id));
    },
  };
}
