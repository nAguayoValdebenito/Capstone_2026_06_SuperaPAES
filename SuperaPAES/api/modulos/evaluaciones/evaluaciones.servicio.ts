// Reglas de negocio del módulo evaluaciones: evaluaciones (práctica, repaso, diagnóstico, mini-ensayo y
// ensayo completo), respuestas corregidas por la base, resultados, estadísticas y progreso.
// Incluye la estructura de cada evaluación (reparto por eje) y las tablas de conversión del DEMRE.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { CupoInvitacionesServicio } from '../cupo-invitaciones/index.js';
import type { PreguntasServicio } from '../preguntas/index.js';
import type { SuscripcionesServicio } from '../suscripciones/index.js';
import type { EvaluacionesRepositorio } from './evaluaciones.repositorio.js';

export interface DependenciasEvaluacionesServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  cupoInvitaciones: CupoInvitacionesServicio;
  preguntas: PreguntasServicio;
  suscripciones: SuscripcionesServicio;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearEvaluacionesRepositorio(bd). */
  repositorio?: EvaluacionesRepositorio;
}

export type EvaluacionesServicio = Record<string, never>;

export function crearEvaluacionesServicio(
  _dependencias: DependenciasEvaluacionesServicio,
): EvaluacionesServicio {
  return {};
}
