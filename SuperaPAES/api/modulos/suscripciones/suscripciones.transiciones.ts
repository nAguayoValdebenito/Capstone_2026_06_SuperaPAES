// Cambios de estado de una suscripción por un aviso de la tienda (RN-26, tabla «Estados de la
// suscripción»; HU-44). Funciones puras: reciben el estado de aquí y lo que la tienda informa hoy, y
// devuelven los estados por los que pasa, en orden. Decisiones del 03/11/2026 (docs/contratos/HU-44.md):
// - Una activa que la tienda da por terminada por cobro pasa por en mora antes de vencer (dos registros).
// - Un reembolso o una revocación la deja cancelada, también desde en mora.
// - Una en mora que termina sin cobrarse queda vencida aunque el estudiante haya cancelado.
import type { EstadoSuscripcion, SuscripcionEnTienda } from '../../adaptadores/pagos/pasarela.js';

/** RN-26: a qué estados pasa cada uno. Cancelada y vencida son finales. */
export const CAMBIOS_PERMITIDOS: Readonly<Record<EstadoSuscripcion, readonly EstadoSuscripcion[]>> =
  {
    pendiente: ['activa', 'fallida'],
    fallida: ['activa'],
    activa: ['en_mora', 'cancelada'],
    en_mora: ['activa', 'vencida'],
    cancelada: [],
    vencida: [],
  };

const FINALES: readonly EstadoSuscripcion[] = ['cancelada', 'vencida'];

export type EnTienda = Pick<SuscripcionEnTienda, 'estado' | 'fin'>;

/** El estado de RN-26 al que lleva lo que informa la tienda, partiendo del de aquí. */
export function destinoDe(actual: EstadoSuscripcion, enTienda: EnTienda): EstadoSuscripcion {
  if (enTienda.estado !== 'terminada') return enTienda.estado;
  if (enTienda.fin === 'reembolso') return 'cancelada';
  if (enTienda.fin === 'cobro' || actual === 'en_mora') return 'vencida';
  return 'cancelada';
}

/**
 * Los estados por los que pasa la suscripción, en orden: [] si no cambia de estado y null si RN-26 no
 * lo permite (se registra el aviso como ignorado y la suscripción queda igual).
 */
export function pasosHacia(
  actual: EstadoSuscripcion,
  enTienda: EnTienda,
): EstadoSuscripcion[] | null {
  const destino = destinoDe(actual, enTienda);
  if (destino === actual) return [];
  // Ya terminó: otro final no la cambia y un estado con acceso no la reabre.
  if (FINALES.includes(actual)) return FINALES.includes(destino) ? [] : null;
  if (CAMBIOS_PERMITIDOS[actual].includes(destino)) return [destino];
  if (actual === 'activa' && destino === 'vencida') return ['en_mora', 'vencida'];
  if (actual === 'en_mora' && destino === 'cancelada' && enTienda.fin === 'reembolso')
    return ['cancelada'];
  return null;
}
