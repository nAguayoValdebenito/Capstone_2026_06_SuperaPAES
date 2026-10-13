// Reglas de negocio del módulo administracion: gestión de usuarios internos y especialidades,
// parámetros del sistema (contenido.configuracion), auditoría, panel de métricas y consulta de
// estudiantes.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionRepositorio } from './administracion.repositorio.js';

export interface DependenciasAdministracionServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearAdministracionRepositorio(bd). */
  repositorio?: AdministracionRepositorio;
}

export type AdministracionServicio = Record<string, never>;

export function crearAdministracionServicio(
  _dependencias: DependenciasAdministracionServicio,
): AdministracionServicio {
  return {};
}
