// Reglas de negocio del módulo administracion: gestión de usuarios internos y especialidades,
// parámetros del sistema (contenido.configuracion), documentos legales, auditoría, panel de
// métricas y consulta de estudiantes.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
import { cifrarContrasena, validarContrasena } from '../../comun/contrasenas.js';
import { ErrorConflicto, ErrorNoEncontrado, ErrorValidacion } from '../../comun/errores.js';
import type { RolCuentaInterna } from '../../comun/roles.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import {
  type AdministracionRepositorio,
  crearAdministracionRepositorio,
  type EntradaAuditoria,
  type UsuarioInterno,
} from './administracion.repositorio.js';
import type {
  DatosCrearUsuarioInterno,
  DatosEditarUsuarioInterno,
} from './administracion.validadores.js';

export type { UsuarioInterno } from './administracion.repositorio.js';

export interface DependenciasAdministracionServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  /**
   * Cierra las sesiones abiertas de una cuenta que se desactiva, en la misma transacción (CU-23 3.b):
   * sin esto su token de renovación seguiría vivo. Las sesiones son del módulo cuentas, que se crea
   * después porque usa este servicio; app.ts entrega la función.
   */
  revocarSesionesUsuarioInterno: (id: string, tx: Ejecutor) => Promise<void>;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearAdministracionRepositorio(bd). */
  repositorio?: AdministracionRepositorio;
}

/**
 * Gestión de usuarios internos (RF-C02, CU-23). `autorId` es el administrador que hace el cambio:
 * cada creación, edición, activación y desactivación queda en contenido.auditoria, en la misma
 * transacción que el cambio (RNF-08). La auditoría nunca guarda la contraseña ni su hash.
 */
export interface AdministracionServicio {
  listarUsuariosInternos(): Promise<UsuarioInterno[]>;
  /** La cuenta con su rol y sus áreas, o null si no existe (para la sesión de la consola). */
  obtenerUsuarioInterno(id: string): Promise<UsuarioInterno | null>;
  crearUsuarioInterno(autorId: string, datos: DatosCrearUsuarioInterno): Promise<UsuarioInterno>;
  editarUsuarioInterno(
    autorId: string,
    id: string,
    cambios: DatosEditarUsuarioInterno,
  ): Promise<UsuarioInterno>;
  /**
   * CU-23 3.b: una cuenta desactivada no puede iniciar sesión y sus sesiones abiertas se cierran.
   * Repetir el estado no cambia nada.
   * CU-23 3.c: no se desactiva la propia cuenta ni al último administrador activo (409).
   */
  cambiarEstadoUsuarioInterno(
    autorId: string,
    id: string,
    activo: boolean,
  ): Promise<UsuarioInterno>;
  /**
   * Registra una acción de la consola en contenido.auditoria (RNF-08), dentro de la transacción del
   * módulo que hace el cambio. Nunca recibe contraseñas, hashes ni códigos.
   */
  registrarAuditoria(entrada: EntradaAuditoria, tx: Ejecutor): Promise<void>;
  /**
   * Parámetro de negocio entero de contenido.configuracion (por ejemplo cupo_verificado). Falla si la
   * clave no existe o no es un entero: un parámetro roto no debe tomar un valor por defecto.
   */
  obtenerParametroEntero(clave: string): Promise<number>;
}

interface Contexto {
  repositorio: AdministracionRepositorio;
  unidadDeTrabajo: UnidadDeTrabajo;
  revocarSesiones: DependenciasAdministracionServicio['revocarSesionesUsuarioInterno'];
}

const ENTIDAD_USUARIO_INTERNO = 'usuario_interno';
const RESTRICCION_CORREO_UNICO = 'ux_usuario_interno_correo';

function errorDeCampo(ruta: string, mensaje: string): ErrorValidacion {
  return new ErrorValidacion([{ lugar: 'cuerpo', ruta, mensaje }], mensaje);
}

/** Lo que se guarda en la auditoría: sin contraseña ni hash, con las áreas como lista de ids. */
function fotografia({ nombre, correo, rol, activo, areas }: UsuarioInterno) {
  return { nombre, correo, rol, activo, areas };
}

/** Las áreas de especialidad definen qué revisa un docente (RN-10); un administrador no tiene. */
function comprobarAreas(rol: RolCuentaInterna, areas: readonly number[]): void {
  if (rol === 'admin' && areas.length > 0) {
    throw errorDeCampo('areas', 'Solo un docente revisor tiene áreas de especialidad.');
  }
  if (rol === 'docente' && areas.length === 0) {
    throw errorDeCampo('areas', 'Un docente revisor necesita al menos un área de especialidad.');
  }
}

interface ErrorDeBase {
  code?: unknown;
  constraint?: unknown;
  table?: unknown;
}

function esErrorDeBase(error: unknown): error is ErrorDeBase {
  return typeof error === 'object' && error !== null && 'code' in error;
}

/** Traduce a errores de la API las restricciones de la base que dependen de los datos enviados. */
async function traducirErrores<T>(trabajo: () => Promise<T>): Promise<T> {
  try {
    return await trabajo();
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    if (error.code === '23505' && error.constraint === RESTRICCION_CORREO_UNICO) {
      throw new ErrorConflicto('Ya existe una cuenta interna con ese correo.');
    }
    if (error.code === '23503' && error.table === 'docente_especialidad') {
      throw errorDeCampo('areas', 'Un área de especialidad no existe.');
    }
    throw error;
  }
}

/**
 * Continuidad del administrador (CU-23 3.c, HU-04 escenario 6): la propia cuenta no se desactiva ni
 * pierde el rol de administrador, y el último administrador activo tampoco. Se llama con los
 * administradores activos ya bloqueados en la transacción. Al rechazar no se escribe la auditoría.
 */
function protegerContinuidad(
  autorId: string,
  cuenta: UsuarioInterno,
  administradoresActivos: readonly string[],
  cambio: 'desactivar' | 'quitar_rol',
): void {
  if (cuenta.id === autorId) {
    throw new ErrorConflicto(
      cambio === 'desactivar'
        ? 'No puedes desactivar tu propia cuenta.'
        : 'No puedes quitarte el rol de administrador.',
    );
  }
  if (cuenta.rol === 'admin' && cuenta.activo && administradoresActivos.length <= 1) {
    throw new ErrorConflicto(
      'Es el último administrador activo: la consola quedaría sin administradores. Activa o crea otro antes.',
    );
  }
}

async function obtener(
  { repositorio }: Contexto,
  id: string,
  tx: Ejecutor,
  bloquear = false,
): Promise<UsuarioInterno> {
  const usuario = await repositorio.buscarUsuarioInterno(id, bloquear, tx);
  if (!usuario) throw new ErrorNoEncontrado('El usuario interno no existe.');
  return usuario;
}

async function crearUsuario(contexto: Contexto, autorId: string, datos: DatosCrearUsuarioInterno) {
  const { repositorio, unidadDeTrabajo } = contexto;
  comprobarAreas(datos.rol, datos.areas);
  return traducirErrores(async () => {
    const hashContrasena = await cifrarContrasena(datos.contrasena);
    return unidadDeTrabajo.enTransaccion(async (tx) => {
      const { nombre, correo, rol, areas } = datos;
      const id = await repositorio.crearUsuarioInterno({ nombre, correo, rol, hashContrasena }, tx);
      await repositorio.reemplazarEspecialidades(id, areas, tx);
      const creado = await obtener(contexto, id, tx);
      await repositorio.registrarAuditoria(
        {
          usuarioId: autorId,
          accion: 'crear_usuario',
          entidad: ENTIDAD_USUARIO_INTERNO,
          entidadId: id,
          antes: null,
          despues: fotografia(creado),
        },
        tx,
      );
      return creado;
    });
  });
}

/** La contraseña nueva cumple RN-31 frente al correo de la cuenta; null si no se cambia. */
async function cifrarNueva(contrasena: string | undefined, correo: string): Promise<string | null> {
  if (contrasena === undefined) return null;
  const problema = validarContrasena(contrasena, correo);
  if (problema) throw errorDeCampo('contrasena', problema);
  return cifrarContrasena(contrasena);
}

async function editarUsuario(
  contexto: Contexto,
  autorId: string,
  id: string,
  cambios: DatosEditarUsuarioInterno,
) {
  const { repositorio, unidadDeTrabajo } = contexto;
  return traducirErrores(() =>
    unidadDeTrabajo.enTransaccion(async (tx) => {
      // Primero los administradores y después la cuenta, siempre en el mismo orden (sin bloqueos cruzados).
      const quitaRol = cambios.rol === 'docente';
      const activos = quitaRol ? await repositorio.bloquearAdministradoresActivos(tx) : [];
      const actual = await obtener(contexto, id, tx, true);
      if (quitaRol && actual.rol === 'admin')
        protegerContinuidad(autorId, actual, activos, 'quitar_rol');
      const rol = cambios.rol ?? actual.rol;
      // Al pasar a administrador, las áreas se quitan si no se indican otras.
      const areas = cambios.areas ?? (rol === 'admin' ? [] : actual.areas);
      comprobarAreas(rol, areas);
      const hashContrasena = await cifrarNueva(cambios.contrasena, actual.correo);
      const nombre = cambios.nombre ?? actual.nombre;
      await repositorio.actualizarUsuarioInterno(id, { nombre, rol, hashContrasena }, tx);
      await repositorio.reemplazarEspecialidades(id, areas, tx);
      const editado = await obtener(contexto, id, tx);
      const despues = {
        ...fotografia(editado),
        ...(hashContrasena === null ? {} : { contrasena_cambiada: true }),
      };
      await repositorio.registrarAuditoria(
        {
          usuarioId: autorId,
          accion: 'editar_usuario',
          entidad: ENTIDAD_USUARIO_INTERNO,
          entidadId: id,
          antes: fotografia(actual),
          despues,
        },
        tx,
      );
      return editado;
    }),
  );
}

async function cambiarEstado(contexto: Contexto, autorId: string, id: string, activo: boolean) {
  const { repositorio, unidadDeTrabajo } = contexto;
  return unidadDeTrabajo.enTransaccion(async (tx) => {
    const activos = activo ? [] : await repositorio.bloquearAdministradoresActivos(tx);
    const actual = await obtener(contexto, id, tx, true);
    if (!activo) protegerContinuidad(autorId, actual, activos, 'desactivar');
    if (actual.activo === activo) return actual;
    await repositorio.cambiarActivoUsuarioInterno(id, activo, tx);
    if (!activo) await contexto.revocarSesiones(id, tx);
    const cambiado = { ...actual, activo };
    await repositorio.registrarAuditoria(
      {
        usuarioId: autorId,
        accion: activo ? 'activar_usuario' : 'desactivar_usuario',
        entidad: ENTIDAD_USUARIO_INTERNO,
        entidadId: id,
        antes: fotografia(actual),
        despues: fotografia(cambiado),
      },
      tx,
    );
    return cambiado;
  });
}

export function crearAdministracionServicio(
  dependencias: DependenciasAdministracionServicio,
): AdministracionServicio {
  const contexto: Contexto = {
    repositorio: dependencias.repositorio ?? crearAdministracionRepositorio(dependencias.bd),
    unidadDeTrabajo: dependencias.unidadDeTrabajo,
    revocarSesiones: dependencias.revocarSesionesUsuarioInterno,
  };
  return {
    listarUsuariosInternos: () => contexto.repositorio.listarUsuariosInternos(),
    obtenerUsuarioInterno: (id) => contexto.repositorio.buscarUsuarioInterno(id, false),
    crearUsuarioInterno: (autorId, datos) => crearUsuario(contexto, autorId, datos),
    editarUsuarioInterno: (autorId, id, cambios) => editarUsuario(contexto, autorId, id, cambios),
    cambiarEstadoUsuarioInterno: (autorId, id, activo) =>
      cambiarEstado(contexto, autorId, id, activo),
    registrarAuditoria: (entrada, tx) => contexto.repositorio.registrarAuditoria(entrada, tx),
    obtenerParametroEntero: async (clave) => {
      const valor = await contexto.repositorio.leerParametro(clave);
      if (typeof valor !== 'number' || !Number.isInteger(valor)) {
        throw new Error(`contenido.configuracion no tiene un entero en ${clave}.`);
      }
      return valor;
    },
  };
}
