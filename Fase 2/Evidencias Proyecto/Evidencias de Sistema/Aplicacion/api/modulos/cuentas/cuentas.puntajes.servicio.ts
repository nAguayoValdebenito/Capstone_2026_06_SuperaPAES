// HU-41.1 (RF-A17, RN-16, CU-14a, CP-25): puntajes PAES reales que declara el estudiante. Son opcionales
// y solo se guardan con el permiso de puntajes vigente, que se da aparte de los términos. Retirar el
// permiso borra los puntajes. cuentas.servicio.ts lo expone en su servicio.
import {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorSinPermiso,
  ErrorValidacion,
} from '../../comun/errores.js';
import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import {
  crearPuntajesRepositorio,
  type FilaPuntaje,
  type PuntajesRepositorio,
} from './cuentas.puntajes.repositorio.js';
import type { DatosPuntaje } from './cuentas.puntajes.validadores.js';

/** Lo que recibe crearPuntajes: las dependencias del servicio de cuentas. */
export interface EntradaPuntajes {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  administracion: Pick<AdministracionServicio, 'permisoPuntajesVigente'>;
  reloj: Reloj;
}

/** A41: el permiso (texto vigente y si lo dio) y los puntajes cargados. */
export interface PuntajesPaes {
  permiso: {
    /** La versión vigente del permiso, para mostrarla y enviar su id al darlo. */
    documento: { id: number; version: string; texto: string };
    otorgado: boolean;
    otorgadoEn: Date | null;
  };
  /** Del año de admisión más reciente al más antiguo. Sin el permiso, vacía. */
  puntajes: FilaPuntaje[];
}

export interface Puntajes {
  /** HU-41.1: el permiso y los puntajes del estudiante de la sesión. */
  obtenerPuntajes(estudianteId: string): Promise<PuntajesPaes>;
  /**
   * Da el permiso de puntajes. `documentoId` debe ser la versión vigente que leyó: si cambió, 409
   * CONFLICTO. Darlo de nuevo no cambia nada.
   */
  otorgarPermisoPuntajes(estudianteId: string, documentoId: number): Promise<PuntajesPaes>;
  /** RN-16: retira el permiso y borra todos sus puntajes, en una transacción. */
  retirarPermisoPuntajes(estudianteId: string): Promise<PuntajesPaes>;
  /**
   * Guarda el puntaje de una prueba y un año de admisión; si ya estaba, lo corrige. Sin el permiso,
   * 403 SIN_PERMISO (CP-25). Prueba que no existe o año futuro: 400 VALIDACION con su motivo.
   */
  guardarPuntaje(estudianteId: string, datos: DatosPuntaje): Promise<PuntajesPaes>;
  /** Borra un puntaje propio; si no existe o es de otro estudiante, 404. */
  borrarPuntaje(estudianteId: string, puntajeId: number): Promise<PuntajesPaes>;
}

interface Dependencias {
  repositorio: PuntajesRepositorio;
  unidadDeTrabajo: UnidadDeTrabajo;
  administracion: EntradaPuntajes['administracion'];
  reloj: Reloj;
}

const SIN_PERMISO = 'Para cargar tus puntajes, primero da el permiso para usarlos.';

function errorDeCampo(ruta: string, mensaje: string, motivo: string): ErrorValidacion {
  return new ErrorValidacion([{ lugar: 'cuerpo', ruta, mensaje, motivo }], mensaje);
}

/** Año de Chile de `ahora`: el de la admisión que viene es el siguiente. */
function anioEnChile(ahora: Date): number {
  const anio = new Intl.DateTimeFormat('en', { timeZone: 'America/Santiago', year: 'numeric' });
  return Number(anio.format(ahora));
}

async function documentoVigente({ administracion, reloj }: Dependencias) {
  const documento = await administracion.permisoPuntajesVigente(reloj());
  if (!documento)
    throw new Error('No hay permiso de puntajes vigente: falta cargar la semilla 003.');
  return documento;
}

async function leer(dependencias: Dependencias, estudianteId: string): Promise<PuntajesPaes> {
  const { id, version, texto } = await documentoVigente(dependencias);
  const { repositorio } = dependencias;
  const permiso = await repositorio.permisoVigente(estudianteId, false);
  return {
    permiso: {
      documento: { id, version, texto },
      otorgado: permiso !== null,
      otorgadoEn: permiso?.aceptadoEn ?? null,
    },
    puntajes: permiso ? await repositorio.puntajes(estudianteId) : [],
  };
}

async function otorgar(dependencias: Dependencias, estudianteId: string, documentoId: number) {
  const vigente = await documentoVigente(dependencias);
  if (vigente.id !== documentoId) {
    throw new ErrorConflicto('El permiso de puntajes cambió. Vuelve a leerlo antes de darlo.');
  }
  await dependencias.repositorio.otorgarPermiso(estudianteId, documentoId, dependencias.reloj());
  return leer(dependencias, estudianteId);
}

async function guardar(dependencias: Dependencias, estudianteId: string, datos: DatosPuntaje) {
  const { repositorio, unidadDeTrabajo, reloj } = dependencias;
  const ahora = reloj();
  if (datos.anioAdmision > anioEnChile(ahora) + 1) {
    throw errorDeCampo('anioAdmision', 'Ese año de admisión todavía no llega.', 'anio_invalido');
  }
  if (!(await repositorio.pruebaActiva(datos.pruebaId))) {
    throw errorDeCampo('pruebaId', 'La prueba no existe.', 'prueba_inexistente');
  }
  await unidadDeTrabajo.enTransaccion(async (tx) => {
    const permiso = await repositorio.permisoVigente(estudianteId, true, tx);
    if (!permiso) throw new ErrorSinPermiso(SIN_PERMISO);
    await repositorio.guardarPuntaje(
      { estudianteId, ...datos, consentimientoId: permiso.id, creadoEn: ahora },
      tx,
    );
  });
  return leer(dependencias, estudianteId);
}

async function borrar(dependencias: Dependencias, estudianteId: string, puntajeId: number) {
  if (!(await dependencias.repositorio.borrarPuntaje(estudianteId, puntajeId))) {
    throw new ErrorNoEncontrado('El puntaje no existe.');
  }
  return leer(dependencias, estudianteId);
}

export function crearPuntajes(entrada: EntradaPuntajes): Puntajes {
  const dependencias: Dependencias = {
    repositorio: crearPuntajesRepositorio(entrada.bd),
    unidadDeTrabajo: entrada.unidadDeTrabajo,
    administracion: entrada.administracion,
    reloj: entrada.reloj,
  };
  const { repositorio, unidadDeTrabajo, reloj } = dependencias;
  return {
    obtenerPuntajes: (id) => leer(dependencias, id),
    otorgarPermisoPuntajes: (id, documentoId) => otorgar(dependencias, id, documentoId),
    retirarPermisoPuntajes: async (id) => {
      await unidadDeTrabajo.enTransaccion((tx) =>
        repositorio.revocarPermisoYBorrar(id, reloj(), tx),
      );
      return leer(dependencias, id);
    },
    guardarPuntaje: (id, datos) => guardar(dependencias, id, datos),
    borrarPuntaje: (id, puntajeId) => borrar(dependencias, id, puntajeId),
  };
}
