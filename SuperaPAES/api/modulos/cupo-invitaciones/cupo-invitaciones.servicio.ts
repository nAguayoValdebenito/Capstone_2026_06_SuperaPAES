// Reglas de negocio del módulo cupo-invitaciones: cupo diario de preguntas, usos gratis del mes,
// invitaciones y saldo de bonos.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
// Por ejemplo, evaluaciones pide aquí descontar el cupo (RN-01) dentro de su propia transacción, y
// cuentas pide subir el cupo del día cuando un estudiante verifica su correo.
import { ErrorNoImplementado } from '../../comun/errores.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import {
  crearCupoInvitacionesRepositorio,
  type CupoInvitacionesRepositorio,
  type NuevaInvitacion,
} from './cupo-invitaciones.repositorio.js';

export interface DependenciasCupoInvitacionesServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  /** Entrega los parámetros de contenido.configuracion (cupo_inicial, cupo_verificado...). */
  administracion: AdministracionServicio;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearCupoInvitacionesRepositorio(bd). */
  repositorio?: CupoInvitacionesRepositorio;
}

export interface CupoInvitacionesServicio {
  /** Registra el código de quien invitó al estudiante (RN-03). */
  registrarCodigoInvitacion(estudianteId: string, codigo: string): Promise<void>;
  /**
   * RN-01, HU-05.3: al verificar el correo, el cupo de hoy sube a cupo_verificado (de la
   * configuración) desde ese momento, sin tocar las preguntas ya usadas. Si el estudiante todavía no
   * tiene la fila de hoy, no crea nada: la fila se creará con el valor que corresponda a su correo.
   * Se llama dentro de la transacción de la verificación (módulo cuentas).
   */
  aplicarCupoVerificado(estudianteId: string, tx: Ejecutor): Promise<void>;
  /**
   * HU-01 esc. 3, RN-03: un estudiante nuevo se registró con el código de otro. Crea la fila de
   * app.invitacion dentro de la transacción del registro (módulo cuentas, que ya buscó al invitante
   * por su código). No entrega el bono (HU-47) ni guarda el dispositivo (HU-47.1).
   */
  registrarInvitacion(invitacion: NuevaInvitacion, tx: Ejecutor): Promise<void>;
}

export function crearCupoInvitacionesServicio(
  dependencias: DependenciasCupoInvitacionesServicio,
): CupoInvitacionesServicio {
  const repositorio = dependencias.repositorio ?? crearCupoInvitacionesRepositorio(dependencias.bd);
  return {
    // Esqueleto: se implementa con su historia de usuario.
    registrarCodigoInvitacion: () =>
      Promise.reject(new ErrorNoImplementado('El registro de códigos de invitación')),
    registrarInvitacion: (invitacion, tx) => repositorio.crearInvitacion(invitacion, tx),
    aplicarCupoVerificado: async (estudianteId, tx) => {
      const maximo = await dependencias.administracion.obtenerParametroEntero('cupo_verificado');
      await repositorio.subirMaximoDelDia(estudianteId, maximo, tx);
    },
  };
}
