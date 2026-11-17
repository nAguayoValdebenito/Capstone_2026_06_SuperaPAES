// HU-45.2 (CU-12 1.a, RN-34): la dirección de la gestión de suscripciones de cada tienda.
import { describe, expect, it } from 'vitest';
import { gestionEnTienda } from '../modulos/suscripciones/suscripciones.gestion-tienda.js';

const GENERAL_PLAY = 'https://play.google.com/store/account/subscriptions';
const APP_STORE = 'https://apps.apple.com/account/subscriptions';

describe('gestión de la suscripción en la tienda (HU-45.2)', () => {
  it('Google Play abre la suscripción del producto en el paquete de la app', () => {
    expect(gestionEnTienda('google_play', 'todas_anual', 'cl.superapaes.app')).toBe(
      `${GENERAL_PLAY}?sku=todas_anual&package=cl.superapaes.app`,
    );
  });

  it('sin producto o sin paquete, Google Play abre la lista de suscripciones', () => {
    expect(gestionEnTienda('google_play', null, 'cl.superapaes.app')).toBe(GENERAL_PLAY);
    expect(gestionEnTienda('google_play', 'todas_anual')).toBe(GENERAL_PLAY);
  });

  it('la App Store abre siempre su lista: no admite un producto', () => {
    expect(gestionEnTienda('app_store', 'todas_anual', 'cl.superapaes.app')).toBe(APP_STORE);
  });

  it('escapa el producto para que no cambie la dirección', () => {
    expect(gestionEnTienda('google_play', 'a&package=otro', 'cl.superapaes.app')).toBe(
      `${GENERAL_PLAY}?sku=a%26package%3Dotro&package=cl.superapaes.app`,
    );
  });
});
