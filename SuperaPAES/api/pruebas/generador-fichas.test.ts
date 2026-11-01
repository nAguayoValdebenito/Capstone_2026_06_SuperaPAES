// HU-16.2: la ficha de cada pregunta del lote. La variedad no depende de que el modelo «se acuerde» de
// variar: el servidor reparte antes de llamar un subtema distinto, una habilidad, una dificultad (cuotas de
// RN-09), un tipo de contexto y, en pruebas numéricas, un resultado objetivo.
import { describe, expect, it } from 'vitest';
import {
  armarFichas,
  repartirDificultades,
  subDescriptores,
  type EntradaFichas,
} from '../modulos/generador/generador.fichas.js';

/** Generador pseudoaleatorio determinista (mulberry32), para que una prueba que falle se repita igual. */
function semilla(valor: number): () => number {
  let estado = valor;
  return () => {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MEZCLA = { facil: 30, media: 45, dificil: 25 };
const HABILIDADES = [
  { codigo: 'RP', nombre: 'Resolver problemas', criterios: null },
  { codigo: 'MOD', nombre: 'Modelar', criterios: null },
  { codigo: 'REP', nombre: 'Representar', criterios: null },
  { codigo: 'ARG', nombre: 'Argumentar', criterios: null },
];
const DESCRIPTORES =
  'Resolución de ecuaciones lineales. Problemas que involucren ecuaciones lineales en diversos contextos. Resolución de inecuaciones lineales. Problemas que involucren inecuaciones lineales.';

function entrada(cambios: Partial<EntradaFichas> = {}): EntradaFichas {
  return {
    cantidad: 10,
    nombreContenido: 'Ecuaciones e inecuaciones de primer grado',
    descriptores: DESCRIPTORES,
    habilidades: HABILIDADES,
    mezcla: MEZCLA,
    contextos: ['algebraico', 'cotidiano', 'tabla', 'geométrico', 'financiero'],
    numerica: true,
    usarResultadoObjetivo: true,
    aleatorio: semilla(7),
    ...cambios,
  };
}

describe('subDescriptores', () => {
  it('separa el texto en oraciones', () => {
    expect(subDescriptores(DESCRIPTORES, 'X')).toEqual([
      'Resolución de ecuaciones lineales.',
      'Problemas que involucren ecuaciones lineales en diversos contextos.',
      'Resolución de inecuaciones lineales.',
      'Problemas que involucren inecuaciones lineales.',
    ]);
  });

  it('sin descriptores usa el nombre del contenido', () => {
    expect(subDescriptores(null, 'Proporcionalidad')).toEqual(['Proporcionalidad']);
    expect(subDescriptores('   ', 'Proporcionalidad')).toEqual(['Proporcionalidad']);
  });

  it('acota el largo de cada subtema', () => {
    const largo = `${'a'.repeat(600)}.`;
    expect(subDescriptores(largo, 'X')[0]?.length).toBeLessThanOrEqual(300);
  });
});

describe('repartirDificultades (RN-09: piso y mayores restos; empate: media, fácil, difícil)', () => {
  it.each([
    [10, { facil: 3, media: 5, dificil: 2 }],
    [20, { facil: 6, media: 9, dificil: 5 }],
    [1, { facil: 0, media: 1, dificil: 0 }],
    [3, { facil: 1, media: 1, dificil: 1 }],
    [4, { facil: 1, media: 2, dificil: 1 }],
  ])('%i preguntas', (cantidad, esperado) => {
    expect(repartirDificultades(cantidad, MEZCLA)).toEqual(esperado);
  });

  it('siempre suma la cantidad pedida', () => {
    for (let n = 1; n <= 10; n++) {
      const cuotas = repartirDificultades(n, MEZCLA);
      expect(cuotas.facil + cuotas.media + cuotas.dificil).toBe(n);
    }
  });
});

describe('armarFichas', () => {
  it('arma una ficha por pregunta, numeradas desde 1', () => {
    const fichas = armarFichas(entrada());

    expect(fichas.map((f) => f.orden)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('respeta las cuotas de dificultad', () => {
    const fichas = armarFichas(entrada());
    const cuenta = (d: string) => fichas.filter((f) => f.dificultad === d).length;

    expect([cuenta('facil'), cuenta('media'), cuenta('dificil')]).toEqual([3, 5, 2]);
  });

  it('reparte los subtemas y las habilidades de a uno, sin repetir seguidos y de forma pareja', () => {
    const fichas = armarFichas(entrada());

    for (const campo of ['subDescriptor', 'contexto'] as const) {
      for (let i = 1; i < fichas.length; i++) {
        expect(fichas[i]?.[campo], `${campo} ${String(i)}`).not.toBe(fichas[i - 1]?.[campo]);
      }
    }
    for (let i = 1; i < fichas.length; i++) {
      expect(fichas[i]?.habilidad.codigo).not.toBe(fichas[i - 1]?.habilidad.codigo);
    }
    const usos = (codigo: string) => fichas.filter((f) => f.habilidad.codigo === codigo).length;
    const conteos = HABILIDADES.map((h) => usos(h.codigo));
    expect(Math.max(...conteos) - Math.min(...conteos)).toBeLessThanOrEqual(1);
  });

  it('en pruebas numéricas sortea un resultado objetivo distinto por ficha', () => {
    const fichas = armarFichas(entrada());
    const objetivos = fichas.map((f) => f.resultadoObjetivo);

    expect(objetivos.every((n) => Number.isInteger(n) && (n ?? 0) > 0)).toBe(true);
    expect(new Set(objetivos).size).toBe(objetivos.length);
  });

  it('sin resultado objetivo (para medir con y sin él) o en pruebas no numéricas, no lo pone', () => {
    expect(
      armarFichas(entrada({ usarResultadoObjetivo: false })).every(
        (f) => f.resultadoObjetivo === null,
      ),
    ).toBe(true);
    expect(
      armarFichas(entrada({ numerica: false })).every((f) => f.resultadoObjetivo === null),
    ).toBe(true);
  });

  it('con la misma semilla arma las mismas fichas; con otra, otras', () => {
    const a = armarFichas(entrada({ aleatorio: semilla(1) }));
    const b = armarFichas(entrada({ aleatorio: semilla(1) }));
    const c = armarFichas(entrada({ aleatorio: semilla(2) }));

    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('con un solo subtema y una sola habilidad no falla: los repite', () => {
    const fichas = armarFichas(
      entrada({
        cantidad: 3,
        descriptores: 'Un solo subtema.',
        habilidades: HABILIDADES.slice(0, 1),
      }),
    );

    expect(fichas).toHaveLength(3);
    expect(new Set(fichas.map((f) => f.subDescriptor)).size).toBe(1);
  });
});
