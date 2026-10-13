// Reglas de negocio del módulo preguntas: banco de preguntas, alternativas, versiones, textos de
// estímulo, importaciones y avisos de error de los estudiantes.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { TemarioServicio } from '../temario/index.js';
import type { PreguntasRepositorio } from './preguntas.repositorio.js';

export interface DependenciasPreguntasServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  temario: TemarioServicio;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearPreguntasRepositorio(bd). */
  repositorio?: PreguntasRepositorio;
}

export type PreguntasServicio = Record<string, never>;

export function crearPreguntasServicio(
  _dependencias: DependenciasPreguntasServicio,
): PreguntasServicio {
  return {};
}
