import { describe, expect, it } from 'vitest';
import { problemaDeLasFilas } from '../modulos/evaluaciones/evaluaciones.configuracion.reglas.js';

describe('tablas de conversion completas (HU-63.1, DAS 4.2.5, modelo 11.0)', () => {
  it.each([{ correctas: [0, 2] }, { correctas: [0, 1, 3] }, { correctas: [0, 4, 5] }])(
    'rechaza saltos en $correctas',
    ({ correctas }) => {
      expect(
        problemaDeLasFilas(correctas.map((n) => ({ correctas: n, puntaje: 100 + n * 10 }))),
      ).toContain('sin saltos');
    },
  );
  it('acepta una tabla completa entregada fuera de orden, sin modificarla', () => {
    const filas = [
      { correctas: 2, puntaje: 200 },
      { correctas: 0, puntaje: 100 },
      { correctas: 1, puntaje: 100 },
    ];
    const original = structuredClone(filas);
    expect(problemaDeLasFilas(filas)).toBeNull();
    expect(filas).toEqual(original);
  });
});
