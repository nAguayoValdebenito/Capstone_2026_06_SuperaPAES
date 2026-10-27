// Reglas de negocio del módulo temario: áreas, pruebas, habilidades, ejes y contenidos del temario PAES,
// y las pruebas que sugiere cada área de carrera.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import {
  type Area,
  type AreaCarreraPerfil,
  type AlcancePractica,
  crearTemarioRepositorio,
  type CursoPerfil,
  type FilaHabilidad,
  type FilaTemario,
  type PruebaPerfil,
  type TemarioRepositorio,
} from './temario.repositorio.js';

export type { Area } from './temario.repositorio.js';

/** Lo que muestran las pantallas del perfil (A08 a A10, HU-29): cursos, pruebas y áreas de carrera. */
export interface OpcionesPerfil {
  cursos: CursoPerfil[];
  pruebas: PruebaPerfil[];
  areasCarrera: AreaCarreraPerfil[];
}

/** Contenido o habilidad del temario: un id y su nombre. */
export interface ContenidoTemario {
  id: number;
  nombre: string;
}

export interface EjeTemario {
  id: number;
  nombre: string;
  contenidos: ContenidoTemario[];
}

/** Prueba con sus ejes (y los contenidos de cada eje) y sus habilidades, en el orden del temario. */
export interface PruebaTemario {
  id: number;
  codigo: string;
  nombre: string;
  ejes: EjeTemario[];
  habilidades: ContenidoTemario[];
}

/** Arma el árbol prueba → ejes → contenidos, y las habilidades de cada prueba. */
function armarTemario(
  filas: readonly FilaTemario[],
  habilidades: readonly FilaHabilidad[],
): PruebaTemario[] {
  const pruebas = new Map<number, PruebaTemario>();
  const ejes = new Map<number, EjeTemario>();
  for (const fila of filas) {
    let prueba = pruebas.get(fila.pruebaId);
    if (!prueba) {
      prueba = {
        id: fila.pruebaId,
        codigo: fila.pruebaCodigo,
        nombre: fila.pruebaNombre,
        ejes: [],
        habilidades: [],
      };
      pruebas.set(prueba.id, prueba);
    }
    if (fila.ejeId === null || fila.ejeNombre === null) continue;
    let eje = ejes.get(fila.ejeId);
    if (!eje) {
      eje = { id: fila.ejeId, nombre: fila.ejeNombre, contenidos: [] };
      ejes.set(eje.id, eje);
      prueba.ejes.push(eje);
    }
    if (fila.contenidoId !== null && fila.contenidoNombre !== null) {
      eje.contenidos.push({ id: fila.contenidoId, nombre: fila.contenidoNombre });
    }
  }
  for (const { id, pruebaId, nombre } of habilidades) {
    pruebas.get(pruebaId)?.habilidades.push({ id, nombre });
  }
  return [...pruebas.values()];
}

export interface DependenciasTemarioServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearTemarioRepositorio(bd). */
  repositorio?: TemarioRepositorio;
}

export interface TemarioServicio {
  /** Áreas de especialidad de los docentes, ordenadas por nombre (C10, HU-04). */
  listarAreas(): Promise<Area[]>;
  /** Valida pertenencia a la prueba y RN-24 para un contenido concreto. */
  alcancePracticaValido(datos: AlcancePractica, tx?: Ejecutor): Promise<boolean>;
  /**
   * Pruebas con sus ejes, contenidos y habilidades, activos o no: el banco de preguntas (HU-11) filtra
   * por ellos y muestra sus nombres, y una pregunta puede seguir en un contenido que ya no está activo.
   */
  listarTemario(): Promise<PruebaTemario[]>;
  /**
   * HU-29.1 (RF-A04, RN-25): cursos de 1° a 4° medio y egresado, pruebas activas con sus electivos y
   * áreas de carrera activas con las pruebas y el electivo que sugiere cada una.
   */
  opcionesPerfil(): Promise<OpcionesPerfil>;
}

export function crearTemarioServicio(dependencias: DependenciasTemarioServicio): TemarioServicio {
  const repositorio = dependencias.repositorio ?? crearTemarioRepositorio(dependencias.bd);
  return {
    listarAreas: () => repositorio.listarAreas(),
    alcancePracticaValido: (datos, tx) => repositorio.alcancePracticaValido(datos, tx),
    // Una consulta tras otra: así también sirve con una sola conexión.
    listarTemario: async () => {
      const filas = await repositorio.listarTemario();
      return armarTemario(filas, await repositorio.listarHabilidades());
    },
    opcionesPerfil: async () => ({
      cursos: await repositorio.listarCursosPerfil(),
      pruebas: await repositorio.listarPruebasPerfil(),
      areasCarrera: await repositorio.listarAreasCarrera(),
    }),
  };
}
