// Controlador del módulo cuentas: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores. El cuerpo ya viene validado por validar() en las rutas.
import type { Request, RequestHandler } from 'express';
import { ErrorNoAutenticado } from '../../comun/errores.js';
import { responder } from '../../comun/respuesta.js';
import type { CuentasServicio } from './cuentas.servicio.js';
import type {
  Credenciales,
  CredencialesApp,
  DatosBusquedaEstudiante,
  DatosCodigoVerificacion,
  DatosEnlaceVerificacion,
  DatosRecuperacion,
  DatosRegistro,
  DatosTokenRenovacion,
  ParametrosEstudiante,
} from './cuentas.validadores.js';

/** Manejador cuyo cuerpo ya fue validado y tipado por validar() en la ruta. */
type ConCuerpo<C> = RequestHandler<Record<string, string>, unknown, C>;

/** Verificación del correo (HU-05) y confirmación del administrador (C15). */
type ControladorVerificacion = Pick<
  CuentasControlador,
  | 'verificarEnlace'
  | 'verificarCodigo'
  | 'reenviarVerificacion'
  | 'buscarEstudiantes'
  | 'confirmarCorreo'
>;

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
  verificarEnlace: ConCuerpo<DatosEnlaceVerificacion>;
  verificarCodigo: ConCuerpo<DatosCodigoVerificacion>;
  reenviarVerificacion: RequestHandler;
  buscarEstudiantes: RequestHandler;
  confirmarCorreo: RequestHandler<ParametrosEstudiante>;
}

/** Estudiante de la sesión de la app. Lo deja autenticarApp. */
function estudianteDe(req: Request<unknown, unknown, unknown>): string {
  if (!req.estudiante) throw new ErrorNoAutenticado();
  return req.estudiante.id;
}

/** Usuario interno de la sesión de la consola. Lo deja autenticarAdmin. */
function usuarioInternoDe(req: Request<unknown, unknown, unknown>): string {
  if (!req.usuarioInterno) throw new ErrorNoAutenticado();
  return req.usuarioInterno.id;
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
      // El navegador queda en app.token_sesion.dispositivo, para reconocer la sesión.
      responder(res, await servicio.ingresarUsuarioInterno(req.body, req.get('user-agent')));
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
      responder(res, await servicio.obtenerUsuarioConsola(usuarioInternoDe(req)));
    },
    ...crearControladorVerificacion(servicio),
  };
}

function crearControladorVerificacion(servicio: CuentasServicio): ControladorVerificacion {
  return {
    verificarEnlace: async (req, res) => {
      responder(res, await servicio.verificarConEnlace(req.body.token));
    },
    verificarCodigo: async (req, res) => {
      responder(res, await servicio.verificarConCodigo(estudianteDe(req), req.body.codigo));
    },
    reenviarVerificacion: async (req, res) => {
      responder(res, await servicio.emitirVerificacion(estudianteDe(req)));
    },
    buscarEstudiantes: async (_req, res) => {
      // En Express 5 req.query es de solo lectura: validar() deja la consulta validada en res.locals.
      const { correo } = res.locals.consulta as DatosBusquedaEstudiante;
      responder(res, await servicio.buscarEstudiantes(correo));
    },
    confirmarCorreo: async (req, res) => {
      responder(res, await servicio.confirmarCorreo(usuarioInternoDe(req), req.params.id));
    },
  };
}
