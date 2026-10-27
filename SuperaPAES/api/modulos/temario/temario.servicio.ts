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
  type FilaTipoPregunta,
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

/** Tipo de pregunta que admite una prueba (selección múltiple, suficiencia de datos). */
export interface TipoPreguntaTemario {
  codigo: string;
  nombre: string;
}

/**
 * Prueba con sus ejes (y los contenidos de cada eje), sus habilidades y los tipos de pregunta que
 * admite, en el orden del temario. opcionesMin, opcionesMax y requiereTexto son las reglas de RN-08.
 */
export interface PruebaTemario {
  id: number;
  codigo: string;
  nombre: string;
  opcionesMin: number;
  opcionesMax: number;
  requiereTexto: boolean;
  ejes: EjeTemario[];
  habilidades: ContenidoTemario[];
  tiposPregunta: TipoPreguntaTemario[];
}

/** La prueba de la fila, todavía sin ejes, habilidades ni tipos de pregunta. */
function pruebaDe(fila: FilaTemario): PruebaTemario {
  return {
    id: fila.pruebaId,
    codigo: fila.pruebaCodigo,
    nombre: fila.pruebaNombre,
    opcionesMin: fila.opcionesMin,
    opcionesMax: fila.opcionesMax,
    requiereTexto: fila.requiereTexto,
    ejes: [],
    habilidades: [],
    tiposPregunta: [],
  };
}

/** Suma a la prueba el eje y el contenido de la fila, si los tiene. */
function agregarEjeYContenido(
  prueba: PruebaTemario,
  ejes: Map<number, EjeTemario>,
  fila: FilaTemario,
): void {
  if (fila.ejeId === null || fila.ejeNombre === null) return;
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

/** Arma el árbol prueba → ejes → contenidos, y las habilidades y los tipos de pregunta de cada prueba. */
function armarTemario(
  filas: readonly FilaTemario[],
  habilidades: readonly FilaHabilidad[],
  tiposPregunta: readonly FilaTipoPregunta[],
): PruebaTemario[] {
  const pruebas = new Map<number, PruebaTemario>();
  const ejes = new Map<number, EjeTemario>();
  for (const fila of filas) {
    const prueba = pruebas.get(fila.pruebaId) ?? pruebaDe(fila);
    pruebas.set(prueba.id, prueba);
    agregarEjeYContenido(prueba, ejes, fila);
  }
  for (const { id, pruebaId, nombre } of habilidades) {
    pruebas.get(pruebaId)?.habilidades.push({ id, nombre });
  }
  for (const { pruebaId, codigo, nombre } of tiposPregunta) {
    pruebas.get(pruebaId)?.tiposPregunta.push({ codigo, nombre });
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
   * Con las reglas de RN-08 y los tipos de pregunta de cada prueba, para crear y editar (HU-12).
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
      const habilidades = await repositorio.listarHabilidades();
      return armarTemario(filas, habilidades, await repositorio.listarTiposPregunta());
    },
    opcionesPerfil: async () => ({
      cursos: await repositorio.listarCursosPerfil(),
      pruebas: await repositorio.listarPruebasPerfil(),
      areasCarrera: await repositorio.listarAreasCarrera(),
    }),
  };
}
