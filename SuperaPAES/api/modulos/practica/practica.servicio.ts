// Reglas de negocio del módulo practica: sesiones de práctica, diagnóstico, repaso y ensayos,
// entregas, respuestas corregidas en el servidor, estadísticas y progreso.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { CupoInvitacionesServicio } from '../cupo-invitaciones/index.js';
import type { PreguntasServicio } from '../preguntas/index.js';
import type { SuscripcionesServicio } from '../suscripciones/index.js';
import type { PracticaRepositorio } from './practica.repositorio.js';

export interface DependenciasPracticaServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  cupoInvitaciones: CupoInvitacionesServicio;
  preguntas: PreguntasServicio;
  suscripciones: SuscripcionesServicio;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearPracticaRepositorio(bd). */
  repositorio?: PracticaRepositorio;
}

export type PracticaServicio = Record<string, never>;

export function crearPracticaServicio(
  _dependencias: DependenciasPracticaServicio,
): PracticaServicio {
  return {};
}
