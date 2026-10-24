// Reglas de negocio del módulo cuentas: registro, ingreso, verificación de correo y recuperación de
// contraseña de estudiantes, consentimientos, pruebas elegidas, áreas de carrera de interés,
// puntajes PAES declarados, ingreso del personal interno y sesiones de la app y de la consola.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
import { createHash, randomBytes } from 'node:crypto';
import type { ProveedorCorreo } from '../../adaptadores/fabrica.js';
import type { ConfiguracionVerificacionCorreo } from '../../comun/configuracion.js';
import { cifrarContrasena, compararContrasena } from '../../comun/contrasenas.js';
import { ErrorNoAutenticado, ErrorNoImplementado, ErrorSinPermiso } from '../../comun/errores.js';
import { type Audiencia, firmarToken } from '../../comun/jwt.js';
import type { ComprobarSesion, SecretosJwt } from '../../comun/middleware/autenticacion.js';
import type { Reloj } from '../../comun/reloj.js';
import type { RolCuentaInterna } from '../../comun/roles.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { CupoInvitacionesServicio } from '../cupo-invitaciones/index.js';
import {
  crearCuentasRepositorio,
  type CuentasRepositorio,
  type DuenoSesion,
} from './cuentas.repositorio.js';
import type { Credenciales, CredencialesApp, DatosRegistro } from './cuentas.validadores.js';
import {
  crearVerificacionRepositorio,
  type VerificacionRepositorio,
} from './cuentas.verificacion.repositorio.js';
import {
  crearVerificacionCorreo,
  type VerificacionCorreo,
} from './cuentas.verificacion.servicio.js';

/**
 * Duración de las sesiones (RNF-01: JWT de corta duración que se renueva de forma segura). El DAS no
 * fija los valores; los aprobó el equipo el 24/10/2026. Renovar rota el token de renovación, así que
 * su duración cuenta desde la última renovación, no desde el ingreso.
 */
export const DURACION_TOKEN_ACCESO_SEGUNDOS = 15 * 60;
export const DURACION_TOKEN_RENOVACION_SEGUNDOS: { [A in Audiencia]: number } = {
  admin: 8 * 60 * 60,
  app: 30 * 24 * 60 * 60,
};
/** Bytes al azar del token de renovación (se entrega en base64url y se guarda solo su SHA-256). */
const BYTES_TOKEN_RENOVACION = 32;

export interface DependenciasCuentasServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  correo: ProveedorCorreo;
  administracion: AdministracionServicio;
  /** Sube el cupo del día cuando el estudiante verifica su correo (HU-05.3). */
  cupoInvitaciones: CupoInvitacionesServicio;
  jwt: SecretosJwt;
  reloj: Reloj;
  verificacionCorreo: ConfiguracionVerificacionCorreo;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearCuentasRepositorio(bd). */
  repositorio?: CuentasRepositorio;
  /** Solo para pruebas: reemplaza al de la verificación del correo. */
  repositorioVerificacion?: VerificacionRepositorio;
}

export interface SesionIniciada {
  tokenAcceso: string;
  tokenRenovacion: string;
}

/** Datos mínimos del usuario interno que entrega el ingreso. Nunca el hash de la contraseña. */
export interface UsuarioDeSesion {
  id: string;
  nombre: string;
  correo: string;
  rol: RolCuentaInterna;
}

export interface SesionConsola extends SesionIniciada {
  usuario: UsuarioDeSesion;
}

/** Datos mínimos del estudiante que entrega el ingreso. Nunca el hash ni datos de otros módulos. */
export interface EstudianteDeSesion {
  id: string;
  nombre: string;
  correo: string;
  correoVerificado: boolean;
}

export interface SesionApp extends SesionIniciada {
  estudiante: EstudianteDeSesion;
}

/** Usuario de la sesión para armar el menú de la consola; el docente también trae sus áreas. */
export interface UsuarioConsola extends UsuarioDeSesion {
  areas?: number[];
}

/** Incluye la verificación del correo (cuentas.verificacion.servicio.ts). */
export interface CuentasServicio extends VerificacionCorreo {
  registrarEstudiante(datos: DatosRegistro): Promise<SesionIniciada>;
  /**
   * HU-02.1 (app): correo o contraseña incorrectos, o cuenta eliminada, 401 con el mismo mensaje. Un
   * correo sin verificar sí entra (solo tiene el cupo de RN-01).
   */
  ingresarEstudiante(credenciales: CredencialesApp): Promise<SesionApp>;
  solicitarRecuperacion(correo: string): Promise<void>;
  /** HU-02.1 (consola): correo o contraseña incorrectos, 401; cuenta desactivada, 403 (CU-23 3.b). */
  ingresarUsuarioInterno(credenciales: Credenciales): Promise<SesionConsola>;
  /** Rota el token: revoca la sesión usada y abre otra. Revocado, vencido o de otro tipo: 401. */
  renovarSesion(tipo: Audiencia, tokenRenovacion: string): Promise<SesionIniciada>;
  /** Cierra la sesión del token. Si no existe o ya estaba cerrada, termina igual, sin error. */
  cerrarSesion(tipo: Audiencia, tokenRenovacion: string): Promise<void>;
  /** La usa el middleware de autenticación en cada petición. */
  sesionVigente: ComprobarSesion;
  obtenerUsuarioConsola(id: string): Promise<UsuarioConsola>;
  /** Cierra todas las sesiones abiertas de una cuenta interna (al desactivarla). */
  revocarSesionesUsuarioInterno(id: string, tx: Ejecutor): Promise<void>;
}

interface Contexto {
  repositorio: CuentasRepositorio;
  unidadDeTrabajo: UnidadDeTrabajo;
  administracion: AdministracionServicio;
  jwt: SecretosJwt;
  reloj: Reloj;
}

/** Lo que lleva la sesión además de la cuenta: su tipo (con el rol, en la consola) y el dispositivo. */
type DatosToken = { dispositivo: string | null } & (
  { tipo: 'app' } | { tipo: 'admin'; rol: RolCuentaInterna }
);

const hashDe = (token: string) => createHash('sha256').update(token).digest('hex');

const errorSesion = () =>
  new ErrorNoAutenticado('La sesión no es válida o venció. Inicia sesión de nuevo.');

let rellenoPendiente: Promise<string> | undefined;

/**
 * Hash de una contraseña al azar, creado una sola vez. Con un correo sin cuenta se compara contra él,
 * así el tiempo de respuesta no delata qué correos existen.
 */
function hashDeRelleno(): Promise<string> {
  rellenoPendiente ??= cifrarContrasena(randomBytes(16).toString('hex'));
  return rellenoPendiente;
}

/**
 * Compara siempre con bcrypt, también cuando no hay cuenta (contra un hash de relleno), y responde lo
 * mismo para el correo y para la contraseña: el tiempo y el mensaje no delatan qué correos existen.
 */
async function comprobarCredenciales<C extends { hashContrasena: string }>(
  cuenta: C | null,
  contrasena: string,
): Promise<C> {
  const hash = cuenta?.hashContrasena ?? (await hashDeRelleno());
  const correcta = await compararContrasena(contrasena, hash);
  if (!cuenta || !correcta) {
    throw new ErrorNoAutenticado('El correo o la contraseña no son correctos.');
  }
  return cuenta;
}

async function abrirSesion(
  { repositorio, jwt, reloj }: Contexto,
  cuentaId: string,
  datos: DatosToken,
  tx: Ejecutor,
): Promise<SesionIniciada> {
  const desde = reloj();
  const tokenRenovacion = randomBytes(BYTES_TOKEN_RENOVACION).toString('base64url');
  const expiraEn = new Date(
    desde.getTime() + DURACION_TOKEN_RENOVACION_SEGUNDOS[datos.tipo] * 1000,
  );
  const sid = await repositorio.crearSesion(
    {
      tipo: datos.tipo,
      cuentaId,
      dispositivo: datos.dispositivo,
      hashToken: hashDe(tokenRenovacion),
      expiraEn,
    },
    tx,
  );
  const vigencia = { desde, segundos: DURACION_TOKEN_ACCESO_SEGUNDOS };
  const tokenAcceso =
    datos.tipo === 'admin'
      ? await firmarToken(
          'admin',
          { sub: cuentaId, sid, rol: datos.rol },
          jwt.secretoConsola,
          vigencia,
        )
      : await firmarToken('app', { sub: cuentaId, sid }, jwt.secretoApp, vigencia);
  return { tokenAcceso, tokenRenovacion };
}

async function ingresarInterno(
  contexto: Contexto,
  { correo, contrasena }: Credenciales,
): Promise<SesionConsola> {
  const { repositorio, unidadDeTrabajo, reloj } = contexto;
  const cuenta = await comprobarCredenciales(
    await repositorio.buscarCredencialesInternas(correo),
    contrasena,
  );
  if (!cuenta.activo) {
    throw new ErrorSinPermiso('Tu cuenta está desactivada. Pide a un administrador que la active.');
  }
  const { id, nombre, rol } = cuenta;
  return unidadDeTrabajo.enTransaccion(async (tx) => {
    await repositorio.registrarAccesoInterno(id, reloj(), tx);
    const sesion = await abrirSesion(contexto, id, { tipo: 'admin', rol, dispositivo: null }, tx);
    return { ...sesion, usuario: { id, nombre, correo: cuenta.correo, rol } };
  });
}

async function ingresarDeEstudiante(
  contexto: Contexto,
  { correo, contrasena, dispositivo }: CredencialesApp,
): Promise<SesionApp> {
  const cuenta = await comprobarCredenciales(
    await contexto.repositorio.buscarCredencialesEstudiante(correo),
    contrasena,
  );
  const { id, nombre, correoVerificado } = cuenta;
  const sesion = await contexto.unidadDeTrabajo.enTransaccion((tx) =>
    abrirSesion(contexto, id, { tipo: 'app', dispositivo: dispositivo ?? null }, tx),
  );
  return { ...sesion, estudiante: { id, nombre, correo: cuenta.correo, correoVerificado } };
}

/** En la consola el rol se lee de nuevo: un cambio de rol rige desde la renovación. */
async function datosDelToken(
  { administracion }: Contexto,
  { tipo, cuentaId, dispositivo }: DuenoSesion,
): Promise<DatosToken> {
  if (tipo === 'app') return { tipo, dispositivo };
  const usuario = await administracion.obtenerUsuarioInterno(cuentaId);
  if (!usuario?.activo) throw errorSesion();
  return { tipo, rol: usuario.rol, dispositivo };
}

async function renovar(
  contexto: Contexto,
  tipo: Audiencia,
  tokenRenovacion: string,
): Promise<SesionIniciada> {
  const { repositorio, unidadDeTrabajo, reloj } = contexto;
  return unidadDeTrabajo.enTransaccion(async (tx) => {
    const dueno = await repositorio.consumirSesion(tipo, hashDe(tokenRenovacion), reloj(), tx);
    if (!dueno) throw errorSesion();
    return abrirSesion(contexto, dueno.cuentaId, await datosDelToken(contexto, dueno), tx);
  });
}

async function usuarioConsola({ administracion }: Contexto, id: string): Promise<UsuarioConsola> {
  const usuario = await administracion.obtenerUsuarioInterno(id);
  if (!usuario) throw errorSesion();
  const { nombre, correo, rol, areas } = usuario;
  return rol === 'docente' ? { id, nombre, correo, rol, areas } : { id, nombre, correo, rol };
}

export function crearCuentasServicio(dependencias: DependenciasCuentasServicio): CuentasServicio {
  const contexto: Contexto = {
    repositorio: dependencias.repositorio ?? crearCuentasRepositorio(dependencias.bd),
    unidadDeTrabajo: dependencias.unidadDeTrabajo,
    administracion: dependencias.administracion,
    jwt: dependencias.jwt,
    reloj: dependencias.reloj,
  };
  const { repositorio, reloj } = contexto;
  // Se prepara al crear el servicio para que el primer ingreso con un correo sin cuenta no tarde más.
  void hashDeRelleno();
  return {
    // Esqueletos: cada uno se implementa en la historia de usuario correspondiente.
    registrarEstudiante: () =>
      Promise.reject(new ErrorNoImplementado('El registro de estudiantes')),
    solicitarRecuperacion: () =>
      Promise.reject(new ErrorNoImplementado('La recuperación de contraseña')),
    ingresarEstudiante: (credenciales) => ingresarDeEstudiante(contexto, credenciales),
    ingresarUsuarioInterno: (credenciales) => ingresarInterno(contexto, credenciales),
    renovarSesion: (tipo, token) => renovar(contexto, tipo, token),
    cerrarSesion: (tipo, token) => repositorio.revocarSesion(tipo, hashDe(token), reloj()),
    sesionVigente: (audiencia, { sub, sid, rol }) => {
      if (audiencia === 'app') return repositorio.sesionEstudianteVigente(sid, sub, reloj());
      return rol
        ? repositorio.sesionInternaVigente(sid, sub, rol, reloj())
        : Promise.resolve(false);
    },
    obtenerUsuarioConsola: (id) => usuarioConsola(contexto, id),
    revocarSesionesUsuarioInterno: (id, tx) =>
      repositorio.revocarSesionesUsuarioInterno(id, reloj(), tx),
    ...crearVerificacionCorreo({
      repositorio:
        dependencias.repositorioVerificacion ?? crearVerificacionRepositorio(dependencias.bd),
      unidadDeTrabajo: dependencias.unidadDeTrabajo,
      correo: dependencias.correo,
      administracion: dependencias.administracion,
      cupoInvitaciones: dependencias.cupoInvitaciones,
      reloj,
      configuracion: dependencias.verificacionCorreo,
    }),
  };
}
