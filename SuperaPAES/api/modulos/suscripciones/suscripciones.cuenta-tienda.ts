// Cuenta en la tienda de cada suscripción: el valor que la app pasa al comprar (obfuscatedAccountId en
// Google Play Billing y appAccountToken en StoreKit) para que la tienda devuelva la compra ligada a
// esa suscripción. Es un UUID versión 8 derivado del id con SHA-256 (RFC 9562, apéndice B.2): siempre
// el mismo para la misma suscripción, así que no se guarda. No es un secreto: solo liga la compra.
import { createHash } from 'node:crypto';

/** Espacio de nombres fijo de Supera PAES: cambiarlo desligaría las compras ya hechas. */
const ESPACIO = Buffer.from('4604f11685114f7589116da02b35ab12', 'hex');

export function cuentaEnTienda(suscripcionId: string): string {
  const bytes = createHash('sha256')
    .update(ESPACIO)
    .update(`suscripcion:${suscripcionId}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x80;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
