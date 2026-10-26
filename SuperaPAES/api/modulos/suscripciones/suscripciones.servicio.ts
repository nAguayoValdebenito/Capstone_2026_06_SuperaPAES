// Reglas de negocio del módulo suscripciones: planes, suscripciones compradas en Google Play o la
// App Store, pagos, historial de estados y avisos de las tiendas.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
// La pasarela de cada tienda llega desde la FabricaProveedores; este módulo nunca crea una.
import type { AvisoEntrante, PasarelasPorTienda, Tienda } from '../../adaptadores/fabrica.js';
import { ErrorNoImplementado } from '../../comun/errores.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { SuscripcionesRepositorio } from './suscripciones.repositorio.js';

export interface DependenciasSuscripcionesServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  /** Hora actual, para las reglas que dependen del tiempo. */
  pagos: PasarelasPorTienda;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearSuscripcionesRepositorio(bd). */
  repositorio?: SuscripcionesRepositorio;
}

const NOMBRE_TIENDA: Record<Tienda, string> = {
  google_play: 'Google Play',
  app_store: 'la App Store',
};

export interface SuscripcionesServicio {
  /**
   * Verifica y procesa un aviso de una tienda (RN-17): se registra una sola vez en
   * app.evento_pasarela y cada cambio de estado o de plan queda en app.suscripcion_evento, con el
   * plan anterior y el nuevo, partiendo del último registro.
   */
  recibirAviso(tienda: Tienda, aviso: AvisoEntrante): Promise<void>;
  /**
   * RN-04: ¿una suscripción activa o en mora cubre la prueba? Si la cubre, responder no descuenta
   * cupo (lo pregunta cupo-invitaciones dentro de la transacción de la respuesta).
   */
  cubrePrueba(estudianteId: string, pruebaId: number, tx: Ejecutor): Promise<boolean>;
}

// Esqueleto: el procesamiento de avisos se implementa en el sprint de suscripciones.
export function crearSuscripcionesServicio(
  _dependencias: DependenciasSuscripcionesServicio,
): SuscripcionesServicio {
  return {
    recibirAviso: (tienda) =>
      Promise.reject(
        new ErrorNoImplementado(`El procesamiento de avisos de ${NOMBRE_TIENDA[tienda]}`),
      ),
    // TEMPORAL hasta HU-44: todavía no hay suscripciones, así que ninguna cubre una prueba. HU-44 la
    // reemplaza por la consulta de app.suscripcion y app.suscripcion_prueba (estado activa o en mora).
    cubrePrueba: () => Promise.resolve(false),
  };
}
