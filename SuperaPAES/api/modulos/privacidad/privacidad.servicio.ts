// Reglas de negocio del módulo privacidad: solicitudes de derechos sobre datos personales (Ley
// 21.719), exportación y borrado de la cuenta con seudonimización.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { CuentasServicio } from '../cuentas/index.js';
import type { PrivacidadRepositorio } from './privacidad.repositorio.js';

export interface DependenciasPrivacidadServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  /** Hora actual, para las reglas que dependen del tiempo. */
  cuentas: CuentasServicio;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearPrivacidadRepositorio(bd). */
  repositorio?: PrivacidadRepositorio;
}

export type PrivacidadServicio = Record<string, never>;

export function crearPrivacidadServicio(
  _dependencias: DependenciasPrivacidadServicio,
): PrivacidadServicio {
  return {};
}
