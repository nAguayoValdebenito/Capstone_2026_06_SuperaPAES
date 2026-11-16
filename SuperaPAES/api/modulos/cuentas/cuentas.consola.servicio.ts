// La cuenta propia en la consola, en el módulo cuentas: el usuario de la sesión (/yo, HU-03.2) y el
// cambio de la propia contraseña (correcciones de seguridad, etapa 4). cuentas.servicio.ts los expone en
// su servicio.
//
// Cambio de contraseña: la persona escribe su contraseña actual y la nueva. La actual se comprueba con bcrypt; la nueva cumple
// RN-31 frente al correo de la cuenta y no repite la actual. Al guardarla, en una transacción:
// administracion (dueño de usuario_interno y de la auditoría) guarda el hash, quita la marca de cambio
// pendiente y lo registra sin la contraseña ni el hash; cuentas cierra las demás sesiones de la cuenta y
// deja abierta la de esta petición, para que la persona siga trabajando.
import { cifrarContrasena, validarContrasena } from '../../comun/contrasenas.js';
import { ErrorNoAutenticado, ErrorValidacion } from '../../comun/errores.js';
import type { Reloj } from '../../comun/reloj.js';
import type { RolCuentaInterna } from '../../comun/roles.js';
import type { UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import { comprobarCredenciales } from './cuentas.credenciales.js';
import type { CuentasRepositorio } from './cuentas.repositorio.js';
import type { DatosCambioContrasena } from './cuentas.validadores.js';

/** Datos mínimos del usuario interno que entrega el ingreso. Nunca el hash de la contraseña. */
export interface UsuarioDeSesion {
  id: string;
  nombre: string;
  correo: string;
  rol: RolCuentaInterna;
  /** Debe cambiar la contraseña que le asignó un administrador antes de usar la consola. */
  debeCambiarContrasena: boolean;
}

/** Usuario de la sesión para armar el menú de la consola; el docente también trae sus áreas. */
export interface UsuarioConsola extends UsuarioDeSesion {
  areas?: number[];
}

export interface DependenciasCuentaConsola {
  repositorio: Pick<
    CuentasRepositorio,
    'buscarCredencialesInternas' | 'revocarOtrasSesionesUsuarioInterno'
  >;
  unidadDeTrabajo: UnidadDeTrabajo;
  administracion: Pick<AdministracionServicio, 'obtenerUsuarioInterno' | 'guardarContrasenaPropia'>;
  reloj: Reloj;
}

export interface CuentaConsola {
  /** La cuenta ya no existe: 401, la consola vuelve al ingreso. */
  obtenerUsuarioConsola(id: string): Promise<UsuarioConsola>;
  /**
   * La contraseña actual no es correcta: 401. La nueva no cumple RN-31 o repite la actual: 400
   * VALIDACION con su motivo bajo `nueva`. `sesionId` es la sesión de la petición, que sigue abierta.
   */
  cambiarContrasenaConsola(
    usuarioId: string,
    sesionId: string,
    datos: DatosCambioContrasena,
  ): Promise<void>;
}

const MENSAJE_ACTUAL_INCORRECTA = 'La contraseña actual no es correcta.';
const MENSAJE_IGUAL_ACTUAL = 'La contraseña nueva debe ser distinta de la actual.';
const SESION_TERMINADA = 'La sesión venció o se cerró. Vuelve a iniciar sesión.';

function errorDeNueva(motivo: string, mensaje: string): ErrorValidacion {
  return new ErrorValidacion([{ lugar: 'cuerpo', ruta: 'nueva', mensaje, motivo }], mensaje);
}

async function usuarioConsola(
  { administracion }: DependenciasCuentaConsola,
  id: string,
): Promise<UsuarioConsola> {
  const usuario = await administracion.obtenerUsuarioInterno(id);
  if (!usuario) throw new ErrorNoAutenticado(SESION_TERMINADA);
  const { nombre, correo, rol, areas, debeCambiarContrasena } = usuario;
  const datos = { id, nombre, correo, rol, debeCambiarContrasena };
  return rol === 'docente' ? { ...datos, areas } : datos;
}

/** Compara con bcrypt (siempre, aunque falte la cuenta) y responde 401 con un mensaje claro. */
async function comprobarActual(
  { repositorio }: DependenciasCuentaConsola,
  correo: string,
  actual: string,
): Promise<void> {
  try {
    await comprobarCredenciales(await repositorio.buscarCredencialesInternas(correo), actual);
  } catch (error) {
    if (error instanceof ErrorNoAutenticado)
      throw new ErrorNoAutenticado(MENSAJE_ACTUAL_INCORRECTA);
    throw error;
  }
}

function comprobarNueva({ actual, nueva }: DatosCambioContrasena, correo: string): void {
  const problema = validarContrasena(nueva, correo);
  if (problema) throw errorDeNueva(problema.motivo, problema.mensaje);
  if (nueva === actual) throw errorDeNueva('contrasena_igual_actual', MENSAJE_IGUAL_ACTUAL);
}

async function cambiar(
  dependencias: DependenciasCuentaConsola,
  usuarioId: string,
  sesionId: string,
  datos: DatosCambioContrasena,
): Promise<void> {
  const { administracion, repositorio, unidadDeTrabajo, reloj } = dependencias;
  const usuario = await administracion.obtenerUsuarioInterno(usuarioId);
  if (!usuario) throw new ErrorNoAutenticado(SESION_TERMINADA);
  await comprobarActual(dependencias, usuario.correo, datos.actual);
  comprobarNueva(datos, usuario.correo);
  const hash = await cifrarContrasena(datos.nueva);
  await unidadDeTrabajo.enTransaccion(async (tx) => {
    await administracion.guardarContrasenaPropia(usuarioId, hash, tx);
    await repositorio.revocarOtrasSesionesUsuarioInterno(usuarioId, sesionId, reloj(), tx);
  });
}

export function crearCuentaConsola(dependencias: DependenciasCuentaConsola): CuentaConsola {
  return {
    obtenerUsuarioConsola: (id) => usuarioConsola(dependencias, id),
    cambiarContrasenaConsola: (usuarioId, sesionId, datos) =>
      cambiar(dependencias, usuarioId, sesionId, datos),
  };
}
