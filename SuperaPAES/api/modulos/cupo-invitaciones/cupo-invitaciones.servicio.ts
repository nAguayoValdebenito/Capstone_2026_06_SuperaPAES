// Reglas de negocio del módulo cupo-invitaciones: cupo diario de preguntas, usos gratis del mes,
// invitaciones y saldo de bonos.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
// Por ejemplo, evaluaciones pide aquí descontar el cupo (RN-01) dentro de su propia transacción, y
// cuentas pide subir el cupo del día cuando un estudiante verifica su correo.
import { ErrorNoImplementado } from '../../comun/errores.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import {
  crearCupoDiario,
  type CoberturaSuscripcion,
  type CupoDiario,
} from './cupo-invitaciones.cupo.servicio.js';
import {
  crearCupoInvitacionesRepositorio,
  type CupoInvitacionesRepositorio,
  type NuevaInvitacion,
} from './cupo-invitaciones.repositorio.js';

export type { EstadoCupo, TipoConsumo } from './cupo-invitaciones.cupo.servicio.js';

export interface DependenciasCupoInvitacionesServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  /** Entrega los parámetros de contenido.configuracion (cupo_inicial, cupo_verificado...). */
  administracion: AdministracionServicio;
  /** RN-04: si una suscripción cubre la prueba, responder no descuenta cupo (módulo suscripciones). */
  suscripciones: CoberturaSuscripcion;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearCupoInvitacionesRepositorio(bd). */
  repositorio?: CupoInvitacionesRepositorio;
}

export interface CupoInvitacionesServicio extends CupoDiario {
  /** Registra el código de quien invitó al estudiante (RN-03). */
  registrarCodigoInvitacion(estudianteId: string, codigo: string): Promise<void>;
  /**
   * RN-01, HU-05.3: al verificar el correo, el cupo del día de `ahora` sube a cupo_verificado (de la
   * configuración) desde ese momento, sin tocar las preguntas ya usadas. Si el estudiante todavía no
   * tiene la fila de ese día, no crea nada: la fila se creará con el valor que corresponda a su correo.
   * Se llama dentro de la transacción de la verificación (módulo cuentas), con la hora de su reloj.
   */
  aplicarCupoVerificado(estudianteId: string, ahora: Date, tx: Ejecutor): Promise<void>;
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
    aplicarCupoVerificado: async (estudianteId, ahora, tx) => {
      const maximo = await dependencias.administracion.obtenerParametroEntero('cupo_verificado');
      await repositorio.subirMaximoDelDia(estudianteId, maximo, ahora, tx);
    },
    ...crearCupoDiario({
      repositorio,
      administracion: dependencias.administracion,
      suscripciones: dependencias.suscripciones,
    }),
  };
}
