// Filtros del banco de preguntas (C02, HU-11): el índice del temario y la validación de prueba, eje,
// contenido, habilidad, estado y dificultad. Los usan el banco y las acciones en lote.
import { ErrorValidacion } from '../../comun/errores.js';
import type { ProblemaDeCampo } from '../../comun/middleware/validacion.js';
import type { PruebaTemario } from '../temario/index.js';
import type { PreguntaDelBanco } from './preguntas.banco.tipos.js';
import type { ConsultaBanco, Opcion, PreguntasRepositorio } from './preguntas.repositorio.js';
import type { FiltrosBanco } from './preguntas.validadores.js';

export interface UbicacionContenido {
  prueba: PreguntaDelBanco['prueba'];
  eje: PreguntaDelBanco['eje'];
  contenido: PreguntaDelBanco['contenido'];
}

/** Índices del temario para resolver los filtros y nombrar cada pregunta. */
export interface IndiceTemario {
  pruebas: Set<number>;
  ejes: Map<number, { pruebaId: number; contenidoIds: number[] }>;
  contenidos: Map<number, UbicacionContenido>;
  /** Prueba de cada habilidad. */
  habilidades: Map<number, number>;
}

export function indexarTemario(pruebas: readonly PruebaTemario[]): IndiceTemario {
  const indice: IndiceTemario = {
    pruebas: new Set(),
    ejes: new Map(),
    contenidos: new Map(),
    habilidades: new Map(),
  };
  for (const { ejes, habilidades, ...prueba } of pruebas) {
    indice.pruebas.add(prueba.id);
    for (const habilidad of habilidades) indice.habilidades.set(habilidad.id, prueba.id);
    for (const { contenidos, ...eje } of ejes) {
      indice.ejes.set(eje.id, { pruebaId: prueba.id, contenidoIds: contenidos.map((c) => c.id) });
      for (const contenido of contenidos) {
        const { id, codigo, nombre } = prueba;
        indice.contenidos.set(contenido.id, { prueba: { id, codigo, nombre }, eje, contenido });
      }
    }
  }
  return indice;
}

function errorDeFiltro(ruta: string, mensaje: string): ErrorValidacion {
  const problema: ProblemaDeCampo = { lugar: 'consulta', ruta, mensaje };
  return new ErrorValidacion([problema], mensaje);
}

/** El eje elegido existe y, si hay prueba, es de esa prueba. */
function ejeDelFiltro(filtros: FiltrosBanco, indice: IndiceTemario) {
  if (filtros.eje === undefined) return undefined;
  const eje = indice.ejes.get(filtros.eje);
  if (!eje) throw errorDeFiltro('eje', 'El eje no existe.');
  if (filtros.prueba !== undefined && eje.pruebaId !== filtros.prueba) {
    throw errorDeFiltro('eje', 'El eje no es de la prueba elegida.');
  }
  return eje;
}

/** El contenido elegido existe y es de la prueba y del eje elegidos, si los hay. */
function comprobarContenido(filtros: FiltrosBanco, indice: IndiceTemario): void {
  if (filtros.contenido === undefined) return;
  const ubicacion = indice.contenidos.get(filtros.contenido);
  if (!ubicacion) throw errorDeFiltro('contenido', 'El contenido no existe.');
  const deOtraPrueba = filtros.prueba !== undefined && ubicacion.prueba.id !== filtros.prueba;
  const deOtroEje = filtros.eje !== undefined && ubicacion.eje.id !== filtros.eje;
  if (deOtraPrueba || deOtroEje) {
    throw errorDeFiltro('contenido', 'El contenido no es del eje o la prueba elegidos.');
  }
}

/** La habilidad elegida existe y, si hay prueba, es de esa prueba. */
function comprobarHabilidad(filtros: FiltrosBanco, indice: IndiceTemario): void {
  if (filtros.habilidad === undefined) return;
  const pruebaId = indice.habilidades.get(filtros.habilidad);
  if (pruebaId === undefined) throw errorDeFiltro('habilidad', 'La habilidad no existe.');
  if (filtros.prueba !== undefined && pruebaId !== filtros.prueba) {
    throw errorDeFiltro('habilidad', 'La habilidad no es de la prueba elegida.');
  }
}

/**
 * Convierte prueba, eje, contenido y habilidad en lo que filtra la base. La pregunta no guarda el eje:
 * elegir un eje es elegir todos sus contenidos.
 */
export function resolverTemario(filtros: FiltrosBanco, indice: IndiceTemario) {
  if (filtros.prueba !== undefined && !indice.pruebas.has(filtros.prueba)) {
    throw errorDeFiltro('prueba', 'La prueba no existe.');
  }
  const eje = ejeDelFiltro(filtros, indice);
  comprobarContenido(filtros, indice);
  comprobarHabilidad(filtros, indice);
  const contenidoIds = filtros.contenido === undefined ? eje?.contenidoIds : [filtros.contenido];
  return { pruebaId: filtros.prueba, contenidoIds, habilidadId: filtros.habilidad };
}

export async function comprobarCodigo(
  codigo: string | undefined,
  opciones: () => Promise<Opcion[]>,
  [ruta, mensaje]: [string, string],
): Promise<void> {
  if (codigo === undefined) return;
  if (!(await opciones()).some((opcion) => opcion.codigo === codigo)) {
    throw errorDeFiltro(ruta, mensaje);
  }
}

/** Los filtros del banco ya resueltos (sin la página), como los usa la base. */
export type FiltroResuelto = Omit<ConsultaBanco, 'limite' | 'desde'>;

/**
 * Valida y resuelve los filtros del banco (HU-11): la prueba, el eje, el contenido y la habilidad
 * contra el temario, y el estado y la dificultad contra sus listas. Lo usan el banco y las acciones
 * en lote.
 */
export async function resolverFiltros(
  repositorio: Pick<PreguntasRepositorio, 'listarEstados' | 'listarDificultades'>,
  indice: IndiceTemario,
  filtros: FiltrosBanco,
): Promise<FiltroResuelto> {
  const { pruebaId, contenidoIds, habilidadId } = resolverTemario(filtros, indice);
  await comprobarCodigo(filtros.estado, () => repositorio.listarEstados(), [
    'estado',
    'El estado no existe.',
  ]);
  await comprobarCodigo(filtros.dificultad, () => repositorio.listarDificultades(), [
    'dificultad',
    'La dificultad no existe.',
  ]);
  return {
    pruebaId,
    contenidoIds,
    habilidadId,
    estado: filtros.estado,
    origen: filtros.origen,
    dificultad: filtros.dificultad,
    loteId: filtros.lote,
  };
}
