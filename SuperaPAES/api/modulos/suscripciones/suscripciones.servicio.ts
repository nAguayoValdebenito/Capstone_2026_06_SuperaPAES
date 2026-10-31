// Reglas de negocio del módulo suscripciones: planes, suscripciones compradas en Google Play o la
// App Store, pagos, historial de estados y avisos de las tiendas.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
// La pasarela de cada tienda llega desde la FabricaProveedores; este módulo nunca crea una.
import type { AvisoEntrante, PasarelasPorTienda, Tienda } from '../../adaptadores/fabrica.js';
import { ErrorNoImplementado } from '../../comun/errores.js';
import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import { crearComprasRepositorio } from './suscripciones.compras.repositorio.js';
import { crearComprasServicio, type ComprasServicio } from './suscripciones.compras.servicio.js';
import { crearValidacionRepositorio } from './suscripciones.validacion.repositorio.js';
import {
  crearValidacionServicio,
  type ValidacionServicio,
} from './suscripciones.validacion.servicio.js';
import {
  crearSuscripcionesRepositorio,
  type SuscripcionesRepositorio,
  type SuscripcionVigente,
} from './suscripciones.repositorio.js';

export interface DependenciasSuscripcionesServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  /** Hora actual, para las reglas que dependen del tiempo. */
  reloj: Reloj;
  pagos: PasarelasPorTienda;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearSuscripcionesRepositorio(bd). */
  repositorio?: SuscripcionesRepositorio;
}

const NOMBRE_TIENDA: Record<Tienda, string> = {
  google_play: 'Google Play',
  app_store: 'la App Store',
};

export interface SuscripcionesServicio extends ComprasServicio, ValidacionServicio {
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
  /**
   * RN-34: la suscripción activa o en mora del estudiante, que la tienda sigue cobrando; `null` si
   * no tiene. La pide privacidad antes de borrar la cuenta (HU-08.2, A42b).
   */
  vigenteDe(estudianteId: string): Promise<SuscripcionVigente | null>;
}

// Esqueleto: el procesamiento de avisos se implementa en el sprint de suscripciones.
export function crearSuscripcionesServicio(
  dependencias: DependenciasSuscripcionesServicio,
): SuscripcionesServicio {
  const repositorio = dependencias.repositorio ?? crearSuscripcionesRepositorio(dependencias.bd);
  const comprasRepositorio = crearComprasRepositorio(dependencias.bd);
  const base = { unidadDeTrabajo: dependencias.unidadDeTrabajo, reloj: dependencias.reloj };
  const compras = crearComprasServicio({ ...base, repositorio: comprasRepositorio });
  const validacion = crearValidacionServicio({
    ...base,
    pagos: dependencias.pagos,
    compras: comprasRepositorio,
    validacion: crearValidacionRepositorio(dependencias.bd),
  });
  return {
    ...compras,
    ...validacion,
    recibirAviso: (tienda) =>
      Promise.reject(
        new ErrorNoImplementado(`El procesamiento de avisos de ${NOMBRE_TIENDA[tienda]}`),
      ),
    // Sigue solo el estado (RN-26): hasta HU-44 nada pasa una suscripción a cancelada o vencida al
    // terminar su período, así que una activa sigue cubriendo después de periodo_fin.
    cubrePrueba: (estudianteId, pruebaId, tx) =>
      repositorio.cubrePrueba(estudianteId, pruebaId, tx),
    vigenteDe: (estudianteId) => repositorio.vigenteDe(estudianteId),
  };
}
