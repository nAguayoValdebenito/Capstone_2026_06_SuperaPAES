// Reglas de negocio del módulo revision: asignaciones a docentes, revisiones con la pauta,
// desempate y clasificación de dificultad.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
import { ErrorNoImplementado } from '../../comun/errores.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { PreguntasServicio } from '../preguntas/index.js';
import type { RevisionRepositorio } from './revision.repositorio.js';

export interface DependenciasRevisionServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  administracion: AdministracionServicio;
  preguntas: PreguntasServicio;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearRevisionRepositorio(bd). */
  repositorio?: RevisionRepositorio;
}

export interface RevisionServicio {
  /** Asignaciones pendientes del docente (D01, HU-21 y HU-22). */
  listarMisRevisiones(): Promise<never>;
  /** Preguntas en desempate asignadas al docente (D02, HU-23). */
  listarDesempates(): Promise<never>;
  /** Seguimiento de las revisiones para el administrador (C06). */
  listarSeguimiento(): Promise<never>;
}

// Esqueleto: cada método se implementa en la historia de usuario correspondiente.
export function crearRevisionServicio(
  _dependencias: DependenciasRevisionServicio,
): RevisionServicio {
  return {
    listarMisRevisiones: () => Promise.reject(new ErrorNoImplementado('Mis revisiones')),
    listarDesempates: () => Promise.reject(new ErrorNoImplementado('Los desempates')),
    listarSeguimiento: () =>
      Promise.reject(new ErrorNoImplementado('El seguimiento de las revisiones')),
  };
}
