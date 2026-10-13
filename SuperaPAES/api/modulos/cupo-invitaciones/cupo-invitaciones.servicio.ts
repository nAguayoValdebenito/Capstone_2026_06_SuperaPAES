// Reglas de negocio del módulo cupo-invitaciones: cupo diario de preguntas, invitaciones y saldo de bonos.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
// Por ejemplo, practica pide aquí descontar el cupo (RN-01) dentro de su propia transacción.
import { ErrorNoImplementado } from '../../comun/errores.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { CupoInvitacionesRepositorio } from './cupo-invitaciones.repositorio.js';

export interface DependenciasCupoInvitacionesServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  /** Hora actual, para las reglas que dependen del tiempo. */
  administracion: AdministracionServicio;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearCupoInvitacionesRepositorio(bd). */
  repositorio?: CupoInvitacionesRepositorio;
}

export interface CupoInvitacionesServicio {
  /** Registra el código de quien invitó al estudiante (RN-03). */
  registrarCodigoInvitacion(estudianteId: string, codigo: string): Promise<void>;
}

// Esqueleto: cada método se implementa en la historia de usuario correspondiente.
export function crearCupoInvitacionesServicio(
  _dependencias: DependenciasCupoInvitacionesServicio,
): CupoInvitacionesServicio {
  return {
    registrarCodigoInvitacion: () =>
      Promise.reject(new ErrorNoImplementado('El registro de códigos de invitación')),
  };
}
