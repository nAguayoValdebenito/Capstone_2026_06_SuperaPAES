import { describe, expect, it } from 'vitest';
import { problemasDeMezcla, type FilaMezcla } from './mezcla-dificultad';

const fila = (nombre: string, minimo: number, objetivo: number, maximo: number): FilaMezcla => ({
  codigo: nombre.toLowerCase(),
  nombre,
  minimo,
  objetivo,
  maximo,
});

const VIGENTE = [fila('Fácil', 25, 30, 35), fila('Media', 40, 45, 50), fila('Difícil', 20, 25, 30)];

describe('reglas de la mezcla de dificultad (RN-09)', () => {
  it('la mezcla vigente 30/45/25 no tiene problemas', () => {
    expect(problemasDeMezcla(VIGENTE)).toEqual([]);
  });

  it('avisa cuando los objetivos no suman 100', () => {
    const mezcla = [fila('Fácil', 25, 35, 35), ...VIGENTE.slice(1)];
    expect(problemasDeMezcla(mezcla)).toEqual(['Los objetivos deben sumar 100 (suman 105).']);
  });

  it('avisa si el mínimo pasa del objetivo o el objetivo del máximo', () => {
    const mezcla = [fila('Fácil', 40, 30, 35), ...VIGENTE.slice(1)];
    expect(problemasDeMezcla(mezcla)).toEqual([
      'En «Fácil» el mínimo no puede pasar del objetivo ni este del máximo.',
    ]);
  });

  it('exige enteros de 0 a 100 y que los mínimos y máximos dejen armar la mezcla', () => {
    expect(problemasDeMezcla([fila('Fácil', 25, 30.5, 35), ...VIGENTE.slice(1)])[0]).toContain(
      'números enteros de 0 a 100',
    );
    const altos = VIGENTE.map((f) => ({ ...f, minimo: f.objetivo, maximo: f.objetivo }));
    altos[0] = { ...altos[0]!, minimo: 60, objetivo: 60, maximo: 60 };
    expect(problemasDeMezcla(altos)).toContain('Los mínimos no pueden sumar más de 100.');
  });
});
