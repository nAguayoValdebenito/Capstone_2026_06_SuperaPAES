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
  DatosCurso,
  DatosEnlaceVerificacion,
  DatosPerfil,
  DatosRecuperacion,
  DatosRegistro,
  DatosRestablecer,
  DatosTokenRenovacion,
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

/** Perfil del estudiante (HU-29.1). */
type ControladorPerfil = Pick<
  CuentasControlador,
  'obtenerPerfil' | 'guardarPerfil' | 'confirmarCurso'
>;

/** Cinco minutos: una versión nueva de los términos tarda a lo más eso en verse (RN-30). */
const CACHE_DOCUMENTOS_VIGENTES = 'public, max-age=300';

export interface CuentasControlador {
  registrar: ConCuerpo<DatosRegistro>;
  ingresar: ConCuerpo<CredencialesApp>;
  renovarApp: ConCuerpo<DatosTokenRenovacion>;
  cerrarApp: ConCuerpo<DatosTokenRenovacion>;
  solicitarRecuperacion: ConCuerpo<DatosRecuperacion>;
  restablecerContrasena: ConCuerpo<DatosRestablecer>;
  ingresarConsola: ConCuerpo<Credenciales>;
  renovarConsola: ConCuerpo<DatosTokenRenovacion>;
  cerrarConsola: ConCuerpo<DatosTokenRenovacion>;
  usuarioConsola: RequestHandler;
  documentosVigentes: RequestHandler;
  verificarEnlace: ConCuerpo<DatosEnlaceVerificacion>;
  verificarCodigo: ConCuerpo<DatosCodigoVerificacion>;
  reenviarVerificacion: RequestHandler;
  buscarEstudiantes: RequestHandler;
  confirmarCorreo: RequestHandler;
  obtenerPerfil: RequestHandler;
  guardarPerfil: ConCuerpo<DatosPerfil>;
  confirmarCurso: ConCuerpo<DatosCurso>;
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
      responder(res, await servicio.registrarEstudiante(req.body), { estado: 201 });
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
      responder(res, { solicitada: true }, { estado: 202 });
    },
    restablecerContrasena: async (req, res) => {
      await servicio.restablecerContrasena(req.body.token, req.body.contrasena);
      // No inicia sesión: la app o la consola le piden ingresar con la contraseña nueva (CU-04 paso 5).
      responder(res, { restablecida: true });
    },
    ingresarConsola: async (req, res) => {
      // El navegador queda en app.token_sesion.dispositivo, para reconocer la sesión.
      responder(res, await servicio.ingresarUsuarioInterno(req.body, req.get('user-agent')));
    },
    renovarConsola: async (req, res) => {
      const { tokenRenovacion } = req.body;
      responder(res, await servicio.renovarSesionConsola(tokenRenovacion, req.get('user-agent')));
    },
    cerrarConsola: async (req, res) => {
      // Siempre la misma respuesta, aunque la sesión ya estuviera cerrada o vencida.
      await servicio.cerrarSesionConsola(req.body.tokenRenovacion);
      responder(res, { sesionCerrada: true });
    },
    documentosVigentes: async (_req, res) => {
      // El texto es igual para todos y cambia pocas veces: el navegador y el CDN pueden guardarlo.
      res.set('Cache-Control', CACHE_DOCUMENTOS_VIGENTES);
      responder(res, await servicio.documentosLegalesVigentes());
    },
    usuarioConsola: async (req, res) => {
      responder(res, await servicio.obtenerUsuarioConsola(usuarioInternoDe(req)));
    },
    ...crearControladorVerificacion(servicio),
    ...crearControladorPerfil(servicio),
  };
}

function crearControladorPerfil(servicio: CuentasServicio): ControladorPerfil {
  return {
    obtenerPerfil: async (req, res) => {
      responder(res, await servicio.obtenerPerfil(estudianteDe(req)));
    },
    guardarPerfil: async (req, res) => {
      responder(res, await servicio.guardarPerfil(estudianteDe(req), req.body));
    },
    confirmarCurso: async (req, res) => {
      responder(res, await servicio.confirmarCurso(estudianteDe(req), req.body));
    },
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
      responder(res, await servicio.confirmarCorreo(usuarioInternoDe(req), String(req.params.id)));
    },
  };
}
