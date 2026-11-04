// Dirección de la gestión de suscripciones de cada tienda (HU-45.2, CU-12 1.a, RN-34): solo la tienda puede
// cancelar, así que la app abre esta dirección. Google Play admite ir directo a una suscripción con su
// producto y el paquete de la app; la App Store solo tiene la lista de suscripciones de la cuenta.
import type { Tienda } from '../../adaptadores/pagos/pasarela.js';

const GESTION: Record<Tienda, string> = {
  google_play: 'https://play.google.com/store/account/subscriptions',
  app_store: 'https://apps.apple.com/account/subscriptions',
};

/** Sin producto o sin paquete configurado, se abre la lista de suscripciones de la tienda. */
export function gestionEnTienda(
  tienda: Tienda,
  idProducto: string | null,
  paquete?: string,
): string {
  if (tienda === 'app_store' || !idProducto || !paquete) return GESTION[tienda];
  const consulta = new URLSearchParams({ sku: idProducto, package: paquete });
  return `${GESTION.google_play}?${consulta.toString()}`;
}
