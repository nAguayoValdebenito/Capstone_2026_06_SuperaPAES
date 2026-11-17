// HU-44.1, RN-26: a qué estados pasa una suscripción según lo que informa la tienda, con las
// decisiones del 03/11/2026 (docs/contratos/HU-44.md).
import { describe, expect, it } from 'vitest';
import type { EstadoSuscripcion } from '../adaptadores/pagos/pasarela.js';
import {
  CAMBIOS_PERMITIDOS,
  destinoDe,
  pasosHacia,
  type EnTienda,
} from '../modulos/suscripciones/suscripciones.transiciones.js';

const activa: EnTienda = { estado: 'activa', fin: null };
const enMora: EnTienda = { estado: 'en_mora', fin: null };
const noRenovo: EnTienda = { estado: 'terminada', fin: 'no_renovo' };
const porCobro: EnTienda = { estado: 'terminada', fin: 'cobro' };
const reembolso: EnTienda = { estado: 'terminada', fin: 'reembolso' };

describe('transiciones de la suscripción por los avisos (RN-26)', () => {
  it('sigue la tabla de RN-26: cancelada y vencida son finales', () => {
    expect(CAMBIOS_PERMITIDOS).toEqual({
      pendiente: ['activa', 'fallida'],
      fallida: ['activa'],
      activa: ['en_mora', 'cancelada'],
      en_mora: ['activa', 'vencida'],
      cancelada: [],
      vencida: [],
    });
  });

  it.each<[EstadoSuscripcion, EnTienda, EstadoSuscripcion[]]>([
    ['pendiente', activa, ['activa']],
    ['pendiente', { estado: 'fallida', fin: null }, ['fallida']],
    ['fallida', activa, ['activa']],
    ['activa', enMora, ['en_mora']],
    ['en_mora', activa, ['activa']],
    ['activa', noRenovo, ['cancelada']],
    ['en_mora', porCobro, ['vencida']],
  ])('%s con la tienda en %o pasa a %o', (actual, enTienda, pasos) => {
    expect(pasosHacia(actual, enTienda)).toEqual(pasos);
  });

  it('una activa que termina por cobro pasa por en mora antes de vencer', () => {
    expect(pasosHacia('activa', porCobro)).toEqual(['en_mora', 'vencida']);
  });

  it('una en mora que termina sin renovar queda vencida: no se pudo cobrar', () => {
    expect(destinoDe('en_mora', noRenovo)).toBe('vencida');
    expect(pasosHacia('en_mora', noRenovo)).toEqual(['vencida']);
  });

  it('un reembolso o una revocación la deja cancelada, también desde en mora', () => {
    expect(pasosHacia('activa', reembolso)).toEqual(['cancelada']);
    expect(pasosHacia('en_mora', reembolso)).toEqual(['cancelada']);
  });

  it('sin cambio de estado no hay pasos', () => {
    expect(pasosHacia('activa', activa)).toEqual([]);
    expect(pasosHacia('en_mora', enMora)).toEqual([]);
  });

  it('una terminada no se reabre ni cambia de final', () => {
    expect(pasosHacia('vencida', activa)).toBeNull();
    expect(pasosHacia('cancelada', enMora)).toBeNull();
    expect(pasosHacia('vencida', reembolso)).toEqual([]);
    expect(pasosHacia('cancelada', porCobro)).toEqual([]);
  });

  it('RN-26 no permite los demás cambios', () => {
    expect(pasosHacia('pendiente', enMora)).toBeNull();
    expect(pasosHacia('pendiente', noRenovo)).toBeNull();
    expect(pasosHacia('fallida', enMora)).toBeNull();
    expect(pasosHacia('activa', { estado: 'pendiente', fin: null })).toBeNull();
  });
});
