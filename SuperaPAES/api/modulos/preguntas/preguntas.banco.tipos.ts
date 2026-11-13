// Tipos de lo que entrega el banco de preguntas (C02, HU-11): cada pregunta, la página y las opciones de
// sus filtros. Los usa preguntas.servicio.ts.
import type { Paginacion } from '../../comun/respuesta.js';
import type { PruebaTemario } from '../temario/index.js';
import type { Opcion } from './preguntas.repositorio.js';
import type { OrigenPregunta } from './preguntas.validadores.js';

/** Pregunta tal como la lista el banco (C02): con su estado y sin la alternativa correcta. */
export interface PreguntaDelBanco {
  id: string;
  /** Comienzo del enunciado (hasta 160 caracteres). */
  resumen: string;
  prueba: { id: number; codigo: string; nombre: string };
  eje: { id: number; nombre: string };
  contenido: { id: number; nombre: string };
  estado: Opcion;
  origen: OrigenPregunta;
  dificultadSugerida: Opcion | null;
  /** La que asignan los docentes (RN-12); el filtro de dificultad usa esta. */
  dificultadAsignada: Opcion | null;
  /** Un revisor dijo fácil y el otro difícil (C02: "posiblemente confusa"). */
  posibleAmbigua: boolean;
  /** La etapa permite editarla y enviarla a revisión (borrador u observada, RF-G09, HU-21). */
  editable: boolean;
  actualizadoEn: string;
}

export interface PaginaDelBanco {
  preguntas: PreguntaDelBanco[];
  paginacion: Paginacion;
}

/** Opciones de los filtros del banco: el temario y las listas de estados, orígenes y dificultades. */
export interface FiltrosDelBanco {
  pruebas: PruebaTemario[];
  estados: Opcion[];
  origenes: Opcion[];
  dificultades: Opcion[];
}
