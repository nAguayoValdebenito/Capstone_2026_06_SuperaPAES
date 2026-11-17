// Esquema JSON que se envía al modelo (HU-16.2): se arma por pedido con la cantidad de alternativas y las
// habilidades de la prueba, y pone «resolucion» antes de las alternativas para que el modelo calcule antes
// de escribir la clave (experimento del 31/10/2026: 4 de 4 correctas con ese orden frente a 0 de 2 sin él).
import { describe, expect, it } from 'vitest';
import { esquemaJsonPreguntas, formatoJson } from '../adaptadores/ia/respuesta.js';

interface Alternativas {
  minItems?: number;
  maxItems?: number;
  items: { properties: { letra: { enum: string[] } } };
}
interface Esquema {
  properties: {
    preguntas: {
      minItems: number;
      maxItems: number;
      items: {
        properties: Record<string, unknown> & {
          habilidad: { enum?: string[] };
          alternativas: Alternativas;
        };
        required: string[];
        additionalProperties: boolean;
      };
    };
  };
}

const comoEsquema = (valor: unknown) => valor as Esquema;

describe('esquemaJsonPreguntas', () => {
  const formato = { alternativas: 4, habilidades: ['RP', 'MOD', 'REP', 'ARG'] };

  it('pone la resolución después del enunciado y antes de las alternativas, y todo es obligatorio', () => {
    const pregunta = comoEsquema(esquemaJsonPreguntas(formato)).properties.preguntas.items;

    expect(Object.keys(pregunta.properties)).toEqual([
      'enunciado',
      'resolucion',
      'habilidad',
      'alternativas',
      'explicacion',
      'dificultadSugerida',
    ]);
    expect(pregunta.required).toEqual(Object.keys(pregunta.properties));
    expect(pregunta.additionalProperties).toBe(false);
  });

  it('fija la cantidad de alternativas y sus letras según la prueba', () => {
    const cuatro = comoEsquema(esquemaJsonPreguntas(formato)).properties.preguntas.items.properties
      .alternativas;
    const cinco = comoEsquema(esquemaJsonPreguntas({ ...formato, alternativas: 5 })).properties
      .preguntas.items.properties.alternativas;

    expect([cuatro.minItems, cuatro.maxItems]).toEqual([4, 4]);
    expect(cuatro.items.properties.letra.enum).toEqual(['A', 'B', 'C', 'D']);
    expect([cinco.minItems, cinco.maxItems]).toEqual([5, 5]);
    expect(cinco.items.properties.letra.enum).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('limita la habilidad a las de la prueba y pide una sola pregunta por llamada', () => {
    const esquema = comoEsquema(esquemaJsonPreguntas(formato));

    expect(esquema.properties.preguntas.items.properties.habilidad.enum).toEqual(
      formato.habilidades,
    );
    expect([esquema.properties.preguntas.minItems, esquema.properties.preguntas.maxItems]).toEqual([
      1, 1,
    ]);
  });

  it('sin formato no inventa límites: habilidad libre y letras de la A a la E', () => {
    const pregunta = comoEsquema(esquemaJsonPreguntas()).properties.preguntas.items;

    expect(pregunta.properties.habilidad.enum).toBeUndefined();
    expect(pregunta.properties.alternativas.minItems).toBeUndefined();
    expect(pregunta.properties.alternativas.items.properties.letra.enum).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
    ]);
  });

  it('el texto para DeepSeek incluye el mismo esquema', () => {
    const texto = formatoJson(formato);

    expect(JSON.parse(texto.slice(texto.indexOf('{')))).toEqual(esquemaJsonPreguntas(formato));
  });
});
