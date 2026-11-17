// Código de invitación propio (RN-33): 6 caracteres de letras mayúsculas sin I ni O y dígitos del 2 al
// 9, al azar con crypto.randomInt. La base exige el mismo formato (^[A-HJ-NP-Z2-9]{6}$).
import { describe, expect, it } from 'vitest';
import {
  ALFABETO_CODIGO_INVITACION,
  codigoInvitacion,
  generarCodigoInvitacion,
} from '../comun/codigo-invitacion.js';

describe('generarCodigoInvitacion (RN-33)', () => {
  it('en 1.000 generaciones, cada código cumple el formato que exige la base', () => {
    const codigos = Array.from({ length: 1000 }, generarCodigoInvitacion);

    expect(codigos.filter((c) => !/^[A-HJ-NP-Z2-9]{6}$/.test(c))).toEqual([]);
    expect(codigos.every((c) => codigoInvitacion.safeParse(c).success)).toBe(true);
  });

  it('usa solo letras y números que no se confunden: sin 0, O, 1 ni I', () => {
    expect(ALFABETO_CODIGO_INVITACION).toHaveLength(32);
    expect(ALFABETO_CODIGO_INVITACION).not.toMatch(/[01IO]/);
    const usados = new Set(Array.from({ length: 1000 }, generarCodigoInvitacion).join(''));
    expect([...usados].every((c) => ALFABETO_CODIGO_INVITACION.includes(c))).toBe(true);
    // Con 6.000 caracteres al azar aparecen todos los del alfabeto: no hay un sesgo grueso.
    expect(usados.size).toBe(32);
  });
});
