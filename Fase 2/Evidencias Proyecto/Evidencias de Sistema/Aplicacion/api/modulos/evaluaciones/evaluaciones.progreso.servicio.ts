// HU-38.1 (RF-A10, RN-14, HU-38 esc. 1 a 4): progreso del estudiante por prueba, por eje y por
// habilidad (en Competencia Lectora se refuerza por habilidad), con el acierto por dificultad y el
// ponderado, los ejes a reforzar, el avance semana a semana y el puntaje de cada ensayo completo. Es el
// mismo con cualquier plan: no depende de la suscripción.
import type { AdministracionServicio } from '../administracion/index.js';
import type {
  AciertoPorDificultad,
  FilaEnsayoProgreso,
  FilaGrupoProgreso,
  FilaSemanaProgreso,
  ProgresoRepositorio,
} from './evaluaciones.progreso.repositorio.js';

export interface GrupoProgreso {
  id: number;
  nombre: string;
  respondidas: number;
  correctas: number;
  aciertoPonderado: number;
  aciertoPorDificultad: AciertoPorDificultad;
  aReforzar: boolean;
}

export interface PruebaProgreso {
  pruebaId: number;
  codigo: string;
  nombre: string;
  respondidas: number;
  correctas: number;
  /** Porcentaje de respuestas correctas. */
  acierto: number;
  aciertoPonderado: number;
  aciertoPorDificultad: AciertoPorDificultad;
  ejes: GrupoProgreso[];
  habilidades: GrupoProgreso[];
  semanas: { semana: string; respondidas: number; acierto: number }[];
  ensayos: { id: string; cerradaEn: Date; puntaje: number }[];
}

export interface ProgresoEstudiante {
  /** Solo las pruebas con respuestas que cuentan; sin respuestas, la lista va vacía. */
  pruebas: PruebaProgreso[];
}

export interface ProgresoServicio {
  /** HU-38.1: el progreso del estudiante, sumando prácticas, repasos y evaluaciones. */
  obtenerProgreso(estudianteId: string): Promise<ProgresoEstudiante>;
}

export interface DependenciasProgreso {
  repositorio: ProgresoRepositorio;
  administracion: Pick<AdministracionServicio, 'obtenerParametroEntero'>;
}

/** Las filas de una prueba, sin su pruebaId. */
function dePrueba<T extends { pruebaId: number }>(filas: T[], pruebaId: number) {
  return filas
    .filter((fila) => fila.pruebaId === pruebaId)
    .map(({ pruebaId: _, ...resto }) => resto);
}

async function obtener(
  { repositorio, administracion }: DependenciasProgreso,
  estudianteId: string,
): Promise<ProgresoEstudiante> {
  // RN-14: el mínimo de respuestas y el porcentaje se ajustan en la configuración.
  const regla = {
    minRespuestas: await administracion.obtenerParametroEntero('min_respuestas_eje'),
    umbral: await administracion.obtenerParametroEntero('umbral_eje_debil'),
  };
  const pruebas = await repositorio.leerPruebas(estudianteId);
  const ejes: FilaGrupoProgreso[] = await repositorio.leerEjes(estudianteId);
  const habilidades = await repositorio.leerHabilidades(estudianteId, regla);
  const semanas: FilaSemanaProgreso[] = await repositorio.leerSemanas(estudianteId);
  const ensayos: FilaEnsayoProgreso[] = await repositorio.leerEnsayos(estudianteId);
  return {
    pruebas: pruebas.map((prueba) => ({
      ...prueba,
      ejes: dePrueba(ejes, prueba.pruebaId),
      habilidades: dePrueba(habilidades, prueba.pruebaId),
      semanas: dePrueba(semanas, prueba.pruebaId),
      ensayos: dePrueba(ensayos, prueba.pruebaId),
    })),
  };
}

export function crearProgresoServicio(dependencias: DependenciasProgreso): ProgresoServicio {
  return { obtenerProgreso: (estudianteId) => obtener(dependencias, estudianteId) };
}
