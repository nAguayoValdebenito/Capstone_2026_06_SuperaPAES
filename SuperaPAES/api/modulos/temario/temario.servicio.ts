// Reglas de negocio del módulo temario: áreas, pruebas, habilidades, ejes y contenidos del temario PAES,
// y las pruebas que sugiere cada área de carrera.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import {
  type Area,
  crearTemarioRepositorio,
  type TemarioRepositorio,
} from './temario.repositorio.js';

export type { Area } from './temario.repositorio.js';

export interface DependenciasTemarioServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearTemarioRepositorio(bd). */
  repositorio?: TemarioRepositorio;
}

export interface TemarioServicio {
  /** Áreas de especialidad de los docentes, ordenadas por nombre (C10, HU-04). */
  listarAreas(): Promise<Area[]>;
}

export function crearTemarioServicio(dependencias: DependenciasTemarioServicio): TemarioServicio {
  const repositorio = dependencias.repositorio ?? crearTemarioRepositorio(dependencias.bd);
  return {
    listarAreas: () => repositorio.listarAreas(),
  };
}
