import { describe, expect, it } from 'vitest';
import { textoDeMezcla } from './mezcla-pedida';

describe('texto de la mezcla pedida a la IA', () => {
  it('une los objetivos de cada dificultad, en el orden de la lista', () => {
    const texto = textoDeMezcla([
      { codigo: 'facil', nombre: 'Fácil', minimo: 25, objetivo: 30, maximo: 35 },
      { codigo: 'media', nombre: 'Media', minimo: 40, objetivo: 45, maximo: 50 },
      { codigo: 'dificil', nombre: 'Difícil', minimo: 20, objetivo: 25, maximo: 30 },
    ]);
    expect(texto).toBe('30 % fácil, 45 % media y 25 % difícil');
  });

  it('sin dificultades no hay texto', () => {
    expect(textoDeMezcla([])).toBeNull();
  });
});
