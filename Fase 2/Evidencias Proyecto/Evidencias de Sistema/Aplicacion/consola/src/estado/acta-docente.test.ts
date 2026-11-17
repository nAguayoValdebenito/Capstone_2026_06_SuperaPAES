// @vitest-environment jsdom
// El acta del docente (D01 y D02): los atajos S y N del criterio enfocado (sin modificadores y nunca
// mientras se escribe), el contador de criterios que faltan, el folio y la firma.
import type { KeyboardEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { avanceDeLaPauta, firmaDe, folioDe, respuestaDeTecla, pautaDelActa } from './acta-docente';
import { dificultadDeTecla, type TeclaPulsada } from './clasificar-dificultad';

const PAUTA = [
  { codigo: 'contenido', descripcion: 'Evalúa el contenido.' },
  { codigo: 'habilidad', descripcion: 'Evalúa la habilidad.' },
  { codigo: 'enunciado', descripcion: 'El enunciado es claro.' },
];

const radio = () => {
  const elemento = document.createElement('input');
  elemento.type = 'radio';
  return elemento;
};

const tecla = (key: string, cambios: Partial<TeclaPulsada> = {}): TeclaPulsada => ({
  key,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  target: radio(),
  ...cambios,
});

describe('atajos S y N del criterio enfocado', () => {
  it('S marca Sí y N marca No, en mayúscula o minúscula', () => {
    expect(respuestaDeTecla(tecla('s'))).toBe(true);
    expect(respuestaDeTecla(tecla('S'))).toBe(true);
    expect(respuestaDeTecla(tecla('n'))).toBe(false);
    expect(respuestaDeTecla(tecla('N'))).toBe(false);
  });

  it('otras teclas no son atajos (tampoco 1, 2 y 3 de Clasificar dificultad)', () => {
    for (const key of ['1', '2', '3', 'Enter', ' ', 'x']) {
      expect(respuestaDeTecla(tecla(key))).toBeNull();
    }
  });

  it('S y N no son atajos de Clasificar dificultad: no chocan', () => {
    const dificultades = [
      { codigo: 'facil', nombre: 'Fácil' },
      { codigo: 'media', nombre: 'Media' },
      { codigo: 'dificil', nombre: 'Difícil' },
    ];
    expect(dificultadDeTecla(tecla('s'), dificultades)).toBeNull();
    expect(dificultadDeTecla(tecla('n'), dificultades)).toBeNull();
  });

  it('con Ctrl, Alt o Meta no es un atajo', () => {
    expect(respuestaDeTecla(tecla('s', { ctrlKey: true }))).toBeNull();
    expect(respuestaDeTecla(tecla('n', { altKey: true }))).toBeNull();
    expect(respuestaDeTecla(tecla('s', { metaKey: true }))).toBeNull();
  });

  it('mientras se escribe en un campo de texto no es un atajo', () => {
    expect(respuestaDeTecla(tecla('s', { target: document.createElement('input') }))).toBeNull();
    expect(respuestaDeTecla(tecla('n', { target: document.createElement('textarea') }))).toBeNull();
  });

  it('responde el criterio enfocado y evita que la letra siga su camino', () => {
    const responder = vi.fn();
    const pauta = pautaDelActa(PAUTA, { campos: { criterios: {} }, responder });
    const evento = { ...tecla('n'), preventDefault: vi.fn() };

    pauta.alPresionarTecla('habilidad', evento as unknown as KeyboardEvent<HTMLElement>);
    expect(responder).toHaveBeenCalledWith('habilidad', false);
    expect(evento.preventDefault).toHaveBeenCalled();

    const otra = { ...tecla('Tab'), preventDefault: vi.fn() };
    pauta.alPresionarTecla('habilidad', otra as unknown as KeyboardEvent<HTMLElement>);
    expect(responder).toHaveBeenCalledTimes(1);
    expect(otra.preventDefault).not.toHaveBeenCalled();
  });
});

describe('contador de la pauta', () => {
  it('cuenta los que faltan en plural y singular, y la pauta completa', () => {
    expect(avanceDeLaPauta(PAUTA, {}).texto).toBe('Faltan 3 de 3 criterios');
    expect(
      avanceDeLaPauta(PAUTA, {
        contenido: { cumple: true, observacion: '' },
        habilidad: { cumple: false, observacion: '' },
      }),
    ).toMatchObject({ faltan: 1, total: 3, texto: 'Falta 1 de 3 criterios' });
    expect(
      avanceDeLaPauta(PAUTA, {
        contenido: { cumple: true, observacion: '' },
        habilidad: { cumple: false, observacion: 'No.' },
        enunciado: { cumple: true, observacion: '' },
      }).texto,
    ).toBe('Pauta completa: 2 de 3 se cumplen');
  });

  it('un criterio sin respuesta (cumple null) sigue faltando', () => {
    expect(avanceDeLaPauta(PAUTA, { contenido: { cumple: null, observacion: '' } }).faltan).toBe(3);
  });
});

describe('folio y firma', () => {
  it('el folio lleva el código, la ronda, la fecha de asignación y la fecha límite', () => {
    expect(
      folioDe({
        preguntaId: 244,
        ronda: 2,
        asignadoEn: '2026-10-20T15:00:00.000Z',
        venceEn: '2026-10-22T15:00:00.000Z',
      }),
    ).toEqual({
      codigo: 'P-0244',
      ronda: '2',
      asignada: '20-10-26',
      vence: '22-10-26',
    });
  });

  it('firma con el nombre del docente o «Docente» si falta, y la fecha de hoy en es-CL', () => {
    const hoy = new Date(2026, 10, 14);
    expect(firmaDe('Ana Pérez', hoy)).toEqual({
      quien: 'Ana Pérez',
      fecha: '14 de noviembre de 2026',
    });
    expect(firmaDe(undefined, hoy).quien).toBe('Docente');
    expect(firmaDe('  ', hoy).quien).toBe('Docente');
  });
});
