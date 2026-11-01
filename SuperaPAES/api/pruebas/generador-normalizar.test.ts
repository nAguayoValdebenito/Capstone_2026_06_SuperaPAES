// HU-17.2: comparar enunciados y alternativas «sin contar mayúsculas, tildes, espacios ni signos de
// puntuación» (DAS, HU-17 esc. 2). Los operadores y paréntesis de una expresión matemática no son
// puntuación del texto: quitarlos volvería iguales a «2x + 3» y «2x - 3».
import { describe, expect, it } from 'vitest';
import { normalizarParaComparar } from '../modulos/generador/generador.normalizar.js';

describe('normalizarParaComparar', () => {
  it('ignora mayúsculas, tildes, espacios y puntuación del texto', () => {
    const a = normalizarParaComparar('¿Cuál es el valor de $x$ en la ecuación?');
    const b = normalizarParaComparar('  cual   ES el VALOR de $x$ en la ecuacion  ');

    expect(a).toBe(b);
  });

  it('ignora comillas, signos de apertura, puntos y comas del texto corrido', () => {
    expect(normalizarParaComparar('«Hola», dijo; luego: «¡adiós!».')).toBe(
      normalizarParaComparar('Hola dijo luego adiós'),
    );
  });

  it('no confunde operadores: x + 3 no es x - 3', () => {
    expect(normalizarParaComparar('$2x + 3 = 11$')).not.toBe(
      normalizarParaComparar('$2x - 3 = 11$'),
    );
  });

  it('no confunde paréntesis: 2(x+1) no es 2x+1', () => {
    expect(normalizarParaComparar('$2(x+1)$')).not.toBe(normalizarParaComparar('$2x+1$'));
  });

  it('conserva la coma y el punto entre dígitos: 1,5 no es 15', () => {
    expect(normalizarParaComparar('1,5 m')).not.toBe(normalizarParaComparar('15 m'));
    expect(normalizarParaComparar('0.25')).not.toBe(normalizarParaComparar('025'));
  });

  it('textos distintos siguen siendo distintos', () => {
    expect(normalizarParaComparar('El perímetro de un cuadrado')).not.toBe(
      normalizarParaComparar('El área de un cuadrado'),
    );
  });
});
