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
  type NuevoUsuarioInterno,
  type UsuarioInterno,
} from './administracion.repositorio.js';
import {
  type DatosCrearUsuarioInterno,
  type DatosEditarUsuarioInterno,
  type DatosPrimerAdministrador,
  esquemaPrimerAdministrador,
} from './administracion.validadores.js';

export type { DatosPrimerAdministrador } from './administracion.validadores.js';

export type { UsuarioInterno } from './administracion.repositorio.js';

export interface DependenciasAdministracionServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
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
  crearUsuarioInterno(autorId: string, datos: DatosCrearUsuarioInterno): Promise<UsuarioInterno>;
  editarUsuarioInterno(
    autorId: string,
    id: string,
    cambios: DatosEditarUsuarioInterno,
  ): Promise<UsuarioInterno>;
  /** CU-23 3.b: una cuenta desactivada no puede iniciar sesión. Repetir el estado no cambia nada. */
  cambiarEstadoUsuarioInterno(
    autorId: string,
    id: string,
    activo: boolean,
  ): Promise<UsuarioInterno>;
  /**
   * Primer administrador (TEC-02.2), para `npm run crear-admin -w api`: valida los datos (RN-31), se
   * niega si ya existe un administrador y audita la creación con la misma cuenta como autor.
   */
  crearPrimerAdministrador(datos: DatosPrimerAdministrador): Promise<UsuarioInterno>;
}

interface Contexto {
  repositorio: AdministracionRepositorio;
  unidadDeTrabajo: UnidadDeTrabajo;
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

/** Inserta la cuenta con sus áreas y audita la creación. Sin autor, la cuenta se audita a sí misma. */
async function insertarYAuditar(
  contexto: Contexto,
  tx: Ejecutor,
  autorId: string | null,
  datos: NuevoUsuarioInterno & { areas: readonly number[] },
): Promise<UsuarioInterno> {
  const { repositorio } = contexto;
  const { areas, ...cuenta } = datos;
  const id = await repositorio.crearUsuarioInterno(cuenta, tx);
  await repositorio.reemplazarEspecialidades(id, areas, tx);
  const creado = await obtener(contexto, id, tx);
  await repositorio.registrarAuditoria(
    {
      usuarioId: autorId ?? id,
      accion: 'crear_usuario',
      entidad: ENTIDAD_USUARIO_INTERNO,
      entidadId: id,
      antes: null,
      despues: fotografia(creado),
    },
    tx,
  );
  return creado;
}

async function crearUsuario(contexto: Contexto, autorId: string, datos: DatosCrearUsuarioInterno) {
  comprobarAreas(datos.rol, datos.areas);
  return traducirErrores(async () => {
    const { contrasena, ...resto } = datos;
    const hashContrasena = await cifrarContrasena(contrasena);
    return contexto.unidadDeTrabajo.enTransaccion((tx) =>
      insertarYAuditar(contexto, tx, autorId, { ...resto, hashContrasena }),
    );
  });
}

function validarPrimerAdministrador(entrada: DatosPrimerAdministrador) {
  const resultado = esquemaPrimerAdministrador.safeParse(entrada);
  if (resultado.success) return resultado.data;
  const problemas = resultado.error.issues.map((problema) => ({
    lugar: 'entrada',
    ruta: problema.path.join('.'),
    mensaje: problema.message,
  }));
  throw new ErrorValidacion(problemas, problemas[0]?.mensaje);
}

async function crearPrimerAdministrador(contexto: Contexto, entrada: DatosPrimerAdministrador) {
  const { contrasena, ...datos } = validarPrimerAdministrador(entrada);
  return traducirErrores(async () => {
    const hashContrasena = await cifrarContrasena(contrasena);
    return contexto.unidadDeTrabajo.enTransaccion(async (tx) => {
      if (await contexto.repositorio.hayAdministrador(tx)) {
        throw new ErrorConflicto(
          'Ya existe un administrador: las demás cuentas se crean desde Usuarios internos (C10).',
        );
      }
      const cuenta = { ...datos, rol: 'admin' as const, areas: [], hashContrasena };
      return insertarYAuditar(contexto, tx, null, cuenta);
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
      const actual = await obtener(contexto, id, tx, true);
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
    const actual = await obtener(contexto, id, tx, true);
    if (actual.activo === activo) return actual;
    await repositorio.cambiarActivoUsuarioInterno(id, activo, tx);
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
  };
  return {
    listarUsuariosInternos: () => contexto.repositorio.listarUsuariosInternos(),
    crearUsuarioInterno: (autorId, datos) => crearUsuario(contexto, autorId, datos),
    editarUsuarioInterno: (autorId, id, cambios) => editarUsuario(contexto, autorId, id, cambios),
    cambiarEstadoUsuarioInterno: (autorId, id, activo) =>
      cambiarEstado(contexto, autorId, id, activo),
    crearPrimerAdministrador: (datos) => crearPrimerAdministrador(contexto, datos),
  };
}
