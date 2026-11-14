// @vitest-environment jsdom
// Reglas de D03 (HU-25.2): los atajos 1, 2 y 3 (sin modificadores y nunca mientras se escribe en un
// campo), el contador en singular y plural, y la asignación que D01 abre desde «Revisar con la pauta».
import { describe, expect, it } from 'vitest';
import { dificultadDeTecla, textoQuedan, type TeclaPulsada } from './clasificar-dificultad';
import { asignacionDeLaConsulta } from './revision-docente';

const DIFICULTADES = [
  { codigo: 'facil', nombre: 'Fácil' },
  { codigo: 'media', nombre: 'Media' },
  { codigo: 'dificil', nombre: 'Difícil' },
];

const tecla = (key: string, cambios: Partial<TeclaPulsada> = {}): TeclaPulsada => ({
  key,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  target: document.body,
  ...cambios,
});

describe('atajos de teclado', () => {
  it.each([
    ['1', 'facil'],
    ['2', 'media'],
    ['3', 'dificil'],
  ])('la tecla %s elige %s', (key, codigo) => {
    expect(dificultadDeTecla(tecla(key), DIFICULTADES)?.codigo).toBe(codigo);
  });

  it('otras teclas no son atajos', () => {
    expect(dificultadDeTecla(tecla('4'), DIFICULTADES)).toBeNull();
    expect(dificultadDeTecla(tecla('Enter'), DIFICULTADES)).toBeNull();
  });

  it('con Ctrl, Alt o Meta no es un atajo (no choca con los del navegador)', () => {
    expect(dificultadDeTecla(tecla('1', { ctrlKey: true }), DIFICULTADES)).toBeNull();
    expect(dificultadDeTecla(tecla('1', { altKey: true }), DIFICULTADES)).toBeNull();
    expect(dificultadDeTecla(tecla('1', { metaKey: true }), DIFICULTADES)).toBeNull();
  });

  it('mientras se escribe en un campo no es un atajo', () => {
    const campo = document.createElement('input');

    expect(dificultadDeTecla(tecla('1', { target: campo }), DIFICULTADES)).toBeNull();
  });
});

describe('textos y consulta', () => {
  it('cuenta en singular y plural', () => {
    expect(textoQuedan(1)).toBe('Queda 1 por clasificar');
    expect(textoQuedan(12)).toBe('Quedan 12 por clasificar');
  });

  it('D01 abre la asignación de ?asignacion= solo si es un id válido', () => {
    expect(asignacionDeLaConsulta('900')).toBe(900);
    expect(asignacionDeLaConsulta(null)).toBeNull();
    expect(asignacionDeLaConsulta('0')).toBeNull();
    expect(asignacionDeLaConsulta('abc')).toBeNull();
    expect(asignacionDeLaConsulta('9'.repeat(17))).toBeNull();
  });
});
