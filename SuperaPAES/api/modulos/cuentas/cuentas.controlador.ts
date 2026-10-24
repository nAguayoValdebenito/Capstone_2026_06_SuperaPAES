// Controlador del módulo cuentas: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores. El cuerpo ya viene validado por validar() en las rutas.
import type { RequestHandler } from 'express';
import { responder } from '../../comun/respuesta.js';
import type { CuentasServicio } from './cuentas.servicio.js';
import type {
  Credenciales,
  DatosRecuperacion,
  DatosRegistro,
  DatosSesionConsola,
} from './cuentas.validadores.js';

/** Manejador cuyo cuerpo ya fue validado y tipado por validar() en la ruta. */
type ConCuerpo<C> = RequestHandler<Record<string, string>, unknown, C>;

export interface CuentasControlador {
  registrar: ConCuerpo<DatosRegistro>;
  ingresar: ConCuerpo<Credenciales>;
  solicitarRecuperacion: ConCuerpo<DatosRecuperacion>;
  ingresarConsola: ConCuerpo<Credenciales>;
  renovarConsola: ConCuerpo<DatosSesionConsola>;
  cerrarSesionConsola: ConCuerpo<DatosSesionConsola>;
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
    solicitarRecuperacion: async (req, res) => {
      // Siempre la misma respuesta, exista o no la cuenta, para no revelar qué correos están registrados.
      await servicio.solicitarRecuperacion(req.body.correo);
      responder(res, { enviado: true }, { estado: 202 });
    },
    // El navegador queda en app.token_sesion.dispositivo, para reconocer la sesión.
    ingresarConsola: async (req, res) => {
      responder(res, await servicio.ingresarUsuarioInterno(req.body, req.get('user-agent')));
    },
    renovarConsola: async (req, res) => {
      const { tokenRenovacion } = req.body;
      responder(res, await servicio.renovarSesionConsola(tokenRenovacion, req.get('user-agent')));
    },
    cerrarSesionConsola: async (req, res) => {
      await servicio.cerrarSesionConsola(req.body.tokenRenovacion);
      responder(res, { cerrada: true });
    },
  };
}
