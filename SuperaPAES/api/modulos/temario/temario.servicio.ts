// Reglas de negocio del módulo temario: áreas, pruebas, habilidades, ejes y contenidos del temario PAES,
// y las pruebas que sugiere cada área de carrera.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
import { ErrorValidacion } from '../../comun/errores.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import { crearTemarioGeneracionRepositorio } from './temario.generacion.repositorio.js';
import {
  type Area,
  type AreaCarreraPerfil,
  type AlcancePractica,
  crearTemarioRepositorio,
  type CursoPerfil,
  type DificultadPractica,
  type FilaHabilidad,
  type FilaTemario,
  type FilaTipoPregunta,
  type PruebaPerfil,
  type PruebaPractica,
  type TemarioRepositorio,
} from './temario.repositorio.js';

export type { Area } from './temario.repositorio.js';

/** Lo que muestran las pantallas del perfil (A08 a A10, HU-29): cursos, pruebas y áreas de carrera. */
export interface OpcionesPerfil {
  cursos: CursoPerfil[];
  pruebas: PruebaPerfil[];
  areasCarrera: AreaCarreraPerfil[];
}

/** Lo que muestran las pantallas para personalizar la práctica (A13 y A14, HU-30). */
export interface OpcionesPractica {
  dificultades: DificultadPractica[];
  pruebas: PruebaPractica[];
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

/** HU-16.2: lo que se sabe de un contenido para pedirle una pregunta a la IA. */
export interface ContenidoParaGenerar {
  contenidoId: number;
  nombre: string;
  /** Texto con oraciones separadas por punto; null si el contenido no trae descriptores. */
  descriptores: string | null;
  activo: boolean;
  /** Curso en que se enseña (por ejemplo «2° medio»); null si no se fija. */
  curso: string | null;
  eje: { id: number; nombre: string };
  prueba: {
    id: number;
    codigo: string;
    nombre: string;
    /** RN-08: la cantidad máxima de alternativas de la prueba (4 o 5). */
    opcionesMax: number;
    requiereTexto: boolean;
    habilidades: { id: number; codigo: string; nombre: string; criterios: string | null }[];
    tiposPregunta: string[];
  };
}

export interface TemarioServicio {
  /** HU-16.2: el contenido con su eje, su prueba y las habilidades de la prueba; null si no existe. */
  contenidoParaGenerar(contenidoId: number): Promise<ContenidoParaGenerar | null>;
  /** HU-16.2 y RN-09: la mezcla objetivo de dificultad en porcentaje (fácil, media y difícil). */
  mezclaDeDificultad(): Promise<Record<'facil' | 'media' | 'dificil', number>>;
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
  /**
   * HU-30 (RF-A06, RN-09, RN-24): dificultades con su parte de la mezcla y pruebas activas con sus
   * ejes, los contenidos que se enseñan hasta `curso` y sus habilidades. La app manda el curso de su
   * perfil; al iniciar la práctica, evaluaciones vuelve a validar el alcance con el curso guardado.
   * Un curso que no existe: 400 VALIDACION con motivo curso_inexistente.
   */
  opcionesPractica(curso: string): Promise<OpcionesPractica>;
}

const cursoInexistente = () =>
  new ErrorValidacion(
    [
      {
        lugar: 'consulta',
        ruta: 'curso',
        mensaje: 'El curso indicado no existe.',
        motivo: 'curso_inexistente',
      },
    ],
    'El curso indicado no existe.',
  );

/** RN-09: la mezcla objetivo de dificultad en porcentaje, por código. */
function mezclaDe(dificultades: readonly { codigo: string; mezcla: number }[]) {
  const mezcla = { facil: 0, media: 0, dificil: 0 };
  for (const d of dificultades) {
    if (d.codigo === 'facil' || d.codigo === 'media' || d.codigo === 'dificil') {
      mezcla[d.codigo] = d.mezcla;
    }
  }
  return mezcla;
}

export function crearTemarioServicio(dependencias: DependenciasTemarioServicio): TemarioServicio {
  const repositorio = dependencias.repositorio ?? crearTemarioRepositorio(dependencias.bd);
  const generacion = crearTemarioGeneracionRepositorio(dependencias.bd);
  return {
    contenidoParaGenerar: async (contenidoId) => {
      const fila = await generacion.contenido(contenidoId);
      if (fila === null) return null;
      return {
        contenidoId: fila.contenidoId,
        nombre: fila.nombre,
        descriptores: fila.descriptores,
        activo: fila.activo,
        curso: fila.curso,
        eje: { id: fila.ejeId, nombre: fila.ejeNombre },
        prueba: {
          id: fila.pruebaId,
          codigo: fila.pruebaCodigo,
          nombre: fila.pruebaNombre,
          opcionesMax: fila.opcionesMax,
          requiereTexto: fila.requiereTexto,
          habilidades: await generacion.habilidades(fila.pruebaId),
          tiposPregunta: await generacion.tiposPregunta(fila.pruebaId),
        },
      };
    },
    listarAreas: () => repositorio.listarAreas(),
    alcancePracticaValido: (datos, tx) => repositorio.alcancePracticaValido(datos, tx),
    // Una consulta tras otra: así también sirve con una sola conexión.
    listarTemario: async () => {
      const filas = await repositorio.listarTemario();
      const habilidades = await repositorio.listarHabilidades();
      return armarTemario(filas, habilidades, await repositorio.listarTiposPregunta());
    },
    mezclaDeDificultad: async () => mezclaDe(await repositorio.listarDificultades()),
    opcionesPerfil: async () => ({
      cursos: await repositorio.listarCursosPerfil(),
      pruebas: await repositorio.listarPruebasPerfil(),
      areasCarrera: await repositorio.listarAreasCarrera(),
    }),
    opcionesPractica: async (curso) => {
      if (!(await repositorio.cursoExiste(curso))) throw cursoInexistente();
      return {
        dificultades: await repositorio.listarDificultades(),
        pruebas: await repositorio.listarPruebasPractica(curso),
      };
    },
  };
}
