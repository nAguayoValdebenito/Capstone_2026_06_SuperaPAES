// Reglas de negocio del módulo cuentas: registro, ingreso, verificación de correo y recuperación de
// contraseña de estudiantes, consentimientos, pruebas elegidas, áreas de carrera de interés,
// puntajes PAES declarados, ingreso del personal interno y sesiones de la app y de la consola.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
import { createHash, randomBytes } from 'node:crypto';
import type { ProveedorCorreo } from '../../adaptadores/fabrica.js';
import type { ConfiguracionVerificacionCorreo } from '../../comun/configuracion.js';
import { ErrorCuentaDesactivada, ErrorNoAutenticado } from '../../comun/errores.js';
import { type Audiencia, firmarToken } from '../../comun/jwt.js';
import { generarCodigoInvitacion } from '../../comun/codigo-invitacion.js';
import type { ComprobarSesion, SecretosJwt } from '../../comun/middleware/autenticacion.js';
import type { Reloj } from '../../comun/reloj.js';
import type { RolCuentaInterna } from '../../comun/roles.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio, DocumentoLegalVigente } from '../administracion/index.js';
import type { CupoInvitacionesServicio } from '../cupo-invitaciones/index.js';
import {
  crearCuentasRepositorio,
  type CuentasRepositorio,
  type DuenoSesion,
} from './cuentas.repositorio.js';
import { comprobarCredenciales, hashDeRelleno } from './cuentas.credenciales.js';
import {
  crearPerfilPracticaRepositorio,
  type EstadoCuentaCupo,
  type PerfilPractica,
} from './cuentas.perfil-practica.repositorio.js';
import {
  crearRecuperacionRepositorio,
  type RecuperacionRepositorio,
} from './cuentas.recuperacion.repositorio.js';
import { crearRecuperacion, type Recuperacion } from './cuentas.recuperacion.servicio.js';
import {
  crearRegistroRepositorio,
  type RegistroRepositorio,
} from './cuentas.registro.repositorio.js';
import { crearRegistro } from './cuentas.registro.servicio.js';
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
/**
 * Vigencia de la credencial de renovación de la consola. Mientras esté vigente, la consola renueva el
 * token de acceso sin pedir la contraseña.
 */
export const HORAS_SESION_CONSOLA = 8;
export const DURACION_TOKEN_RENOVACION_SEGUNDOS: { [A in Audiencia]: number } = {
  admin: HORAS_SESION_CONSOLA * 60 * 60,
  app: 30 * 24 * 60 * 60,
};
/** Bytes al azar del token de renovación (se entrega en base64url y se guarda solo su SHA-256). */
const BYTES_TOKEN_RENOVACION = 32;
/** app.token_sesion.dispositivo es VARCHAR(100). */
const LARGO_DISPOSITIVO = 100;

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
  /** Solo para pruebas: reemplaza al del registro. */
  repositorioRegistro?: RegistroRepositorio;
  /** Solo para pruebas: reemplaza al de la recuperación de la contraseña. */
  repositorioRecuperacion?: RecuperacionRepositorio;
  /**
   * Ejecuta una tarea sin que la respuesta la espere (el correo de la recuperación). Por defecto la
   * lanza y sigue; las pruebas lo reemplazan para esperarla.
   */
  segundoPlano?: (tarea: () => Promise<void>) => void;
  /** Solo para pruebas: reemplaza al generador del código de invitación propio (RN-33). */
  generarCodigoInvitacion?: () => string;
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

/** Incluye la verificación del correo y la recuperación de la contraseña. */
export interface CuentasServicio extends VerificacionCorreo, Recuperacion {
  /** HU-29.1, contrato mínimo para iniciar una práctica. Con bloquear, serializa inicios sobre el
   * estudiante dentro de la transacción del módulo consumidor. */
  obtenerPerfilPractica(
    estudianteId: string,
    tx?: Ejecutor,
    bloquear?: boolean,
  ): Promise<PerfilPractica | null>;
  /**
   * HU-32.1: si el correo está verificado, para el cupo del día. Con bloquear, toma la fila del
   * estudiante (FOR UPDATE), el primer bloqueo de una respuesta. null si la cuenta no existe o se
   * eliminó.
   */
  estadoParaCupo(
    estudianteId: string,
    tx?: Ejecutor,
    bloquear?: boolean,
  ): Promise<EstadoCuentaCupo | null>;
  /**
   * HU-01.1 (CU-01): crea la cuenta sin verificar con sus consentimientos, la invitación si vino un
   * código y la sesión de la app, en una transacción; después emite el correo de verificación.
   * Correo repetido: 409 CONFLICTO. Documentos, edad, contraseña o código inválidos: 400 VALIDACION con
   * su motivo.
   */
  registrarEstudiante(datos: DatosRegistro): Promise<SesionApp>;
  /**
   * HU-02.1 (app): correo o contraseña incorrectos, o cuenta eliminada, 401 con el mismo mensaje. Un
   * correo sin verificar sí entra (solo tiene el cupo de RN-01).
   */
  ingresarEstudiante(credenciales: CredencialesApp): Promise<SesionApp>;
  /**
   * HU-02.1 (consola): correo o contraseña incorrectos, 401; cuenta desactivada, 403
   * CUENTA_DESACTIVADA (CU-23 3.b). El navegador (User-Agent) queda como dispositivo de la sesión.
   */
  ingresarUsuarioInterno(credenciales: Credenciales, navegador?: string): Promise<SesionConsola>;
  /**
   * Rota el token: revoca la sesión usada y abre otra. Revocado, vencido o de otro tipo: 401. Con
   * `dispositivo`, la sesión nueva lo guarda; sin él, conserva el de la sesión usada.
   */
  renovarSesion(
    tipo: Audiencia,
    tokenRenovacion: string,
    dispositivo?: string,
  ): Promise<SesionIniciada>;
  /** Cierra la sesión del token. Si no existe o ya estaba cerrada, termina igual, sin error. */
  cerrarSesion(tipo: Audiencia, tokenRenovacion: string): Promise<void>;
  /** RNF-01: cambia la credencial de renovación por una sesión nueva, con el rol actual de la cuenta. */
  renovarSesionConsola(tokenRenovacion: string, navegador?: string): Promise<SesionIniciada>;
  /** CU-03: cierra la sesión (revocado_en). Una credencial desconocida o ya cerrada no cambia nada. */
  cerrarSesionConsola(tokenRenovacion: string): Promise<void>;
  /**
   * RN-30, CP-01: la versión vigente de los términos y de la política de privacidad, para el registro
   * de la app y las páginas /terminos y /privacidad de la consola (el mismo texto en las dos).
   */
  documentosLegalesVigentes(): Promise<DocumentoLegalVigente[]>;
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

const SESION_TERMINADA = 'La sesión venció o se cerró. Vuelve a iniciar sesión.';

const errorSesion = () => new ErrorNoAutenticado(SESION_TERMINADA);

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
  navegador: string | undefined,
): Promise<SesionConsola> {
  const { repositorio, unidadDeTrabajo, reloj } = contexto;
  const cuenta = await comprobarCredenciales(
    await repositorio.buscarCredencialesInternas(correo),
    contrasena,
  );
  if (!cuenta.activo) throw new ErrorCuentaDesactivada();
  const { id, nombre, rol } = cuenta;
  return unidadDeTrabajo.enTransaccion(async (tx) => {
    await repositorio.registrarAccesoInterno(id, reloj(), tx);
    const dispositivo = navegador?.slice(0, LARGO_DISPOSITIVO) || null;
    const sesion = await abrirSesion(contexto, id, { tipo: 'admin', rol, dispositivo }, tx);
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
  dispositivo: string | undefined,
): Promise<SesionIniciada> {
  const { repositorio, unidadDeTrabajo, reloj } = contexto;
  return unidadDeTrabajo.enTransaccion(async (tx) => {
    const dueno = await repositorio.consumirSesion(tipo, hashDe(tokenRenovacion), reloj(), tx);
    if (!dueno) throw errorSesion();
    const datos = await datosDelToken(contexto, dueno);
    const nuevo = dispositivo?.slice(0, LARGO_DISPOSITIVO) || datos.dispositivo;
    return abrirSesion(contexto, dueno.cuentaId, { ...datos, dispositivo: nuevo }, tx);
  });
}

async function usuarioConsola({ administracion }: Contexto, id: string): Promise<UsuarioConsola> {
  const usuario = await administracion.obtenerUsuarioInterno(id);
  if (!usuario) throw errorSesion();
  const { nombre, correo, rol, areas } = usuario;
  return rol === 'docente' ? { id, nombre, correo, rol, areas } : { id, nombre, correo, rol };
}

/** Verificación del correo y registro, cada uno en su archivo, sobre el mismo contexto. */
function crearVerificacionYRegistro(dependencias: DependenciasCuentasServicio, contexto: Contexto) {
  const { bd, unidadDeTrabajo, administracion, cupoInvitaciones, reloj } = dependencias;
  const verificacion = crearVerificacionCorreo({
    repositorio: dependencias.repositorioVerificacion ?? crearVerificacionRepositorio(bd),
    unidadDeTrabajo,
    correo: dependencias.correo,
    administracion,
    cupoInvitaciones,
    reloj,
    configuracion: dependencias.verificacionCorreo,
  });
  const registro = crearRegistro({
    repositorio: dependencias.repositorioRegistro ?? crearRegistroRepositorio(bd),
    unidadDeTrabajo,
    administracion,
    cupoInvitaciones,
    reloj,
    abrirSesionApp: (id, tx) => abrirSesion(contexto, id, { tipo: 'app', dispositivo: null }, tx),
    emitirVerificacion: (id) => verificacion.emitirVerificacion(id),
    generarCodigo: dependencias.generarCodigoInvitacion ?? generarCodigoInvitacion,
  });
  const recuperacion = crearRecuperacion({
    repositorio: dependencias.repositorioRecuperacion ?? crearRecuperacionRepositorio(bd),
    unidadDeTrabajo,
    correo: dependencias.correo,
    reloj,
    configuracion: dependencias.verificacionCorreo,
    revocarSesionesEstudiante: (id, tx) =>
      contexto.repositorio.revocarSesionesEstudiante(id, reloj(), tx),
    segundoPlano:
      dependencias.segundoPlano ??
      ((tarea) => {
        void tarea();
      }),
  });
  return { ...verificacion, ...registro, ...recuperacion };
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
  const perfilPractica = crearPerfilPracticaRepositorio(dependencias.bd);
  // Se prepara al crear el servicio para que el primer ingreso con un correo sin cuenta no tarde más.
  void hashDeRelleno();
  return {
    obtenerPerfilPractica: (id, tx, bloquear) =>
      perfilPractica.obtenerPerfilPractica(id, tx, bloquear),
    estadoParaCupo: (id, tx, bloquear) => perfilPractica.estadoParaCupo(id, tx, bloquear),
    ingresarEstudiante: (credenciales) => ingresarDeEstudiante(contexto, credenciales),
    ingresarUsuarioInterno: (credenciales, navegador) =>
      ingresarInterno(contexto, credenciales, navegador),
    renovarSesion: (tipo, token, dispositivo) => renovar(contexto, tipo, token, dispositivo),
    cerrarSesion: (tipo, token) => repositorio.revocarSesion(tipo, hashDe(token), reloj()),
    // La consola renueva con el navegador de la petición, que queda como dispositivo.
    renovarSesionConsola: (token, navegador) => renovar(contexto, 'admin', token, navegador),
    cerrarSesionConsola: (token) => repositorio.revocarSesion('admin', hashDe(token), reloj()),
    // Solo la sesión: la cuenta de la consola la comprueba el middleware con administracion.
    sesionVigente: (audiencia, { sub, sid }) =>
      audiencia === 'app'
        ? repositorio.sesionEstudianteVigente(sid, sub, reloj())
        : repositorio.sesionInternaVigente(sid, sub, reloj()),
    obtenerUsuarioConsola: (id) => usuarioConsola(contexto, id),
    documentosLegalesVigentes: () => dependencias.administracion.documentosLegalesVigentes(reloj()),
    revocarSesionesUsuarioInterno: (id, tx) =>
      repositorio.revocarSesionesUsuarioInterno(id, reloj(), tx),
    ...crearVerificacionYRegistro(dependencias, contexto),
  };
}
