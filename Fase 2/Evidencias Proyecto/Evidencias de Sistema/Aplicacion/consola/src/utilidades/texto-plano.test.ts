import { describe, expect, it } from 'vitest';
import { textoPlano } from './texto-plano';

describe('texto plano de un enunciado con fórmulas', () => {
  it('quita los signos $ y deja el resto', () => {
    expect(textoPlano('¿Cuál es el valor de $8x$ en la ecuación $2x + 3 = 11$?')).toBe(
      '¿Cuál es el valor de 8x en la ecuación 2x + 3 = 11?',
    );
  });

  it('cambia los comandos comunes por su símbolo', () => {
    expect(textoPlano('$3 \\times 4$')).toBe('3 × 4');
    expect(textoPlano('$x \\leq 5$ y $y \\geq 2$')).toBe('x ≤ 5 y y ≥ 2');
    expect(textoPlano('$\\frac{1}{2} + \\sqrt{9}$')).toBe('(1)/(2) + √(9)');
    expect(textoPlano('$a^2 + b^{2}$')).toBe('a² + b²');
  });

  it('no toca un texto sin fórmulas', () => {
    expect(textoPlano('Si hay 5 manzanas, ¿cuántas quedan?')).toBe(
      'Si hay 5 manzanas, ¿cuántas quedan?',
    );
  });
});
