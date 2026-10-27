// Perfil del estudiante (HU-29.1, RF-A04, RN-24, RN-25, CU-05) en el módulo cuentas.
// cuentas.servicio.ts lo expone en su servicio: los demás módulos lo usan a través de él.
//
// El estudiante indica su curso (de 1° a 4° medio) o, si ya egresó, el año de egreso. Se guarda el año
// de egreso y con él la base calcula el curso de cada año escolar, que cambia en marzo (hora de
// Chile). Guardar el perfil o confirmar el curso deja la fecha de confirmación (CU-05 1.a).
// Orden de bloqueo: primero el estudiante y después sus pruebas e intereses.
import { ErrorConflicto, ErrorNoEncontrado, ErrorValidacion } from '../../comun/errores.js';
import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import {
  crearPerfilRepositorio,
  type FilaPerfil,
  type PerfilRepositorio,
} from './cuentas.perfil.repositorio.js';
import type { DatosCurso, DatosPerfil } from './cuentas.validadores.js';

export type { PerfilRepositorio } from './cuentas.perfil.repositorio.js';

const CODIGO_CIENCIAS = 'CIE';
const CURSO_EGRESADO = 'EG';

/** Lo que recibe crearPerfil: las dependencias del servicio de cuentas. */
export interface EntradaPerfil {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  reloj: Reloj;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearPerfilRepositorio(bd). */
  repositorioPerfil?: PerfilRepositorio | undefined;
}

interface DependenciasPerfil {
  repositorio: PerfilRepositorio;
  unidadDeTrabajo: UnidadDeTrabajo;
  reloj: Reloj;
}

export interface PerfilEstudiante {
  /** Tiene curso y al menos una prueba: si no, la app muestra la bienvenida (CU-05 paso 1). */
  completo: boolean;
  /** Curso de hoy en Chile; EG si ya egresó. null sin perfil. */
  curso: { codigo: string; nombre: string } | null;
  anioEgreso: number | null;
  pruebas: number[];
  /** Electivo de Ciencias, o null si no rinde Ciencias. */
  electivoId: number | null;
  pruebaReforzarId: number | null;
  areasCarrera: number[];
  /** La app pide confirmar el curso (A11, CU-05 1.a). */
  debeConfirmarCurso: boolean;
}

export interface Perfil {
  /** HU-29.1: el perfil del estudiante de la sesión. Cuenta eliminada: 404. */
  obtenerPerfil(estudianteId: string): Promise<PerfilEstudiante>;
  /**
   * HU-29.1 (CU-05 pasos 2 a 7, 1.b): guarda todo el perfil en una transacción y confirma el curso.
   * Datos que no cumplen las reglas: 400 VALIDACION con su motivo.
   */
  guardarPerfil(estudianteId: string, datos: DatosPerfil): Promise<PerfilEstudiante>;
  /** CU-05 1.a (A11): confirma o corrige el curso. Sin perfil completo: 409 CONFLICTO. */
  confirmarCurso(estudianteId: string, datos: DatosCurso): Promise<PerfilEstudiante>;
}

function errorDeCampo(ruta: string, mensaje: string, motivo: string): ErrorValidacion {
  return new ErrorValidacion([{ lugar: 'cuerpo', ruta, mensaje, motivo }], mensaje);
}

function aPerfil(fila: FilaPerfil): PerfilEstudiante {
  const completo = fila.anioEgreso !== null && fila.pruebas.length > 0;
  return {
    completo,
    curso:
      fila.cursoCodigo && fila.cursoNombre
        ? { codigo: fila.cursoCodigo, nombre: fila.cursoNombre }
        : null,
    anioEgreso: fila.anioEgreso,
    pruebas: fila.pruebas,
    electivoId: fila.electivoId,
    pruebaReforzarId: fila.pruebaReforzarId,
    areasCarrera: fila.areasCarrera,
    debeConfirmarCurso: completo && fila.cursoPorConfirmar,
  };
}

/**
 * El año de egreso: con un curso, el año escolar de hoy más los años que le faltan (4° medio egresa
 * este año); egresado, el año que indica, que debe ser anterior al año escolar de hoy.
 */
async function anioEgresoDe(
  { repositorio, reloj }: DependenciasPerfil,
  { curso, anioEgreso }: DatosCurso,
  tx: Ejecutor,
): Promise<number> {
  const { anioEscolar, aniosParaEgreso } = await repositorio.anioEscolarYCurso(curso, reloj(), tx);
  if (curso !== CURSO_EGRESADO) {
    if (aniosParaEgreso === null) throw new Error(`El curso ${curso} no tiene años para egresar.`);
    return anioEscolar + aniosParaEgreso;
  }
  if (anioEgreso === undefined || anioEgreso >= anioEscolar) {
    throw errorDeCampo(
      'anioEgreso',
      `El año de egreso debe ser ${anioEscolar - 1} o anterior.`,
      'anio_egreso_invalido',
    );
  }
  return anioEgreso;
}

/** Pruebas activas y electivo de Ciencias: obligatorio si la rinde (CU-05 6.a), prohibido si no. */
async function comprobarPruebas(
  { repositorio }: DependenciasPerfil,
  { pruebas, electivoId }: DatosPerfil,
  tx: Ejecutor,
): Promise<void> {
  const activas = await repositorio.pruebasActivas(pruebas, tx);
  if (activas.length !== pruebas.length) {
    throw errorDeCampo(
      'pruebas',
      'Alguna de las pruebas elegidas no existe.',
      'prueba_inexistente',
    );
  }
  const ciencias = activas.find((prueba) => prueba.codigo === CODIGO_CIENCIAS);
  if (ciencias && electivoId === null) {
    throw errorDeCampo(
      'electivoId',
      'Elige tu electivo de Ciencias: Biología, Física o Química.',
      'electivo_requerido',
    );
  }
  if (
    electivoId !== null &&
    (!ciencias || !(await repositorio.electivoValido(ciencias.id, electivoId, tx)))
  ) {
    throw errorDeCampo(
      'electivoId',
      'El electivo debe ser Biología, Física o Química, y solo si rindes Ciencias.',
      'electivo_invalido',
    );
  }
}

async function comprobarAreasCarrera(
  { repositorio }: DependenciasPerfil,
  { areasCarrera }: DatosPerfil,
  tx: Ejecutor,
): Promise<void> {
  if (areasCarrera.length === 0) return;
  if ((await repositorio.cuantasAreasCarreraActivas(areasCarrera, tx)) !== areasCarrera.length) {
    throw errorDeCampo(
      'areasCarrera',
      'Alguna de las áreas de carrera elegidas no existe.',
      'area_carrera_inexistente',
    );
  }
}

async function leer(
  { repositorio, reloj }: DependenciasPerfil,
  estudianteId: string,
  tx?: Ejecutor,
): Promise<PerfilEstudiante> {
  const fila = await repositorio.leerPerfil(estudianteId, reloj(), tx);
  if (!fila) throw new ErrorNoEncontrado('La cuenta no existe.');
  return aPerfil(fila);
}

async function bloquear(
  { repositorio }: DependenciasPerfil,
  estudianteId: string,
  tx: Ejecutor,
): Promise<{ completo: boolean }> {
  const estudiante = await repositorio.bloquearEstudiante(estudianteId, tx);
  if (!estudiante) throw new ErrorNoEncontrado('La cuenta no existe.');
  return estudiante;
}

export function crearPerfil(entrada: EntradaPerfil): Perfil {
  const { unidadDeTrabajo, reloj } = entrada;
  const repositorio = entrada.repositorioPerfil ?? crearPerfilRepositorio(entrada.bd);
  const dependencias: DependenciasPerfil = { repositorio, unidadDeTrabajo, reloj };
  return {
    obtenerPerfil: (estudianteId) => leer(dependencias, estudianteId),
    guardarPerfil: (estudianteId, datos) =>
      unidadDeTrabajo.enTransaccion(async (tx) => {
        await bloquear(dependencias, estudianteId, tx);
        const anioEgreso = await anioEgresoDe(dependencias, datos, tx);
        await comprobarPruebas(dependencias, datos, tx);
        await comprobarAreasCarrera(dependencias, datos, tx);
        const instante = reloj();
        await repositorio.guardarCurso(estudianteId, anioEgreso, instante, tx);
        await repositorio.guardarElecciones(estudianteId, { ...datos, anioEgreso }, instante, tx);
        return leer(dependencias, estudianteId, tx);
      }),
    confirmarCurso: (estudianteId, datos) =>
      unidadDeTrabajo.enTransaccion(async (tx) => {
        const { completo } = await bloquear(dependencias, estudianteId, tx);
        if (!completo) throw new ErrorConflicto('Completa tu perfil primero.');
        const anioEgreso = await anioEgresoDe(dependencias, datos, tx);
        await repositorio.guardarCurso(estudianteId, anioEgreso, reloj(), tx);
        return leer(dependencias, estudianteId, tx);
      }),
  };
}
