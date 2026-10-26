// HU-31.1/HU-31.3, RN-09: cuotas enteras, mayores restos y desempate oficial.
import { describe, expect, it } from 'vitest';
import { calcularCuotas } from '../modulos/evaluaciones/evaluaciones.cuotas.js';

const mezcla = [
  { codigo: 'facil' as const, objetivo: 30 },
  { codigo: 'media' as const, objetivo: 45 },
  { codigo: 'dificil' as const, objetivo: 25 },
];

describe('calcularCuotas (RN-09)', () => {
  it.each([
    [20, { facil: 6, media: 9, dificil: 5 }],
    [22, { facil: 7, media: 10, dificil: 5 }],
    [65, { facil: 20, media: 29, dificil: 16 }],
    [10, { facil: 3, media: 5, dificil: 2 }],
  ])('reparte %i según el ejemplo oficial', (cantidad, esperado) => {
    expect(calcularCuotas(cantidad, mezcla)).toEqual(esperado);
    expect(calcularCuotas(cantidad, [...mezcla].reverse())).toEqual(esperado);
  });

  it('la suma es la cantidad pedida incluso cuando las cuotas tienen restos', () => {
    for (let cantidad = 0; cantidad <= 200; cantidad++) {
      const cuotas = Object.values(calcularCuotas(cantidad, mezcla));
      expect(cuotas.reduce((total, cuota) => total + cuota, 0)).toBe(cantidad);
      expect(cuotas.every(Number.isInteger)).toBe(true);
    }
  });

  it('usa los objetivos recibidos y no porcentajes fijos', () => {
    expect(
      calcularCuotas(
        20,
        mezcla.map((d) => ({ ...d, objetivo: d.codigo === 'media' ? 40 : 30 })),
      ),
    ).toEqual({ facil: 6, media: 8, dificil: 6 });
  });

  it.each([-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER])(
    'rechaza una cantidad inválida: %s',
    (cantidad) => {
      expect(() => calcularCuotas(cantidad, mezcla)).toThrow();
    },
  );

  it('rechaza una mezcla incompleta, duplicada o que no suma 100', () => {
    expect(() => calcularCuotas(20, mezcla.slice(1))).toThrow();
    expect(() => calcularCuotas(20, [mezcla[0]!, mezcla[0]!, mezcla[2]!])).toThrow();
    expect(() =>
      calcularCuotas(
        20,
        mezcla.map((d) => ({ ...d, objetivo: 20 })),
      ),
    ).toThrow();
  });
});
