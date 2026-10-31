// Validación técnica compartida; las reglas pedagógicas pertenecen a HU-17.1.
import { z } from 'zod';
import { ErrorIARespuestaInvalida, ErrorIANoDisponible } from '../../comun/errores.js';
import { ErrorContenidoVacio, ErrorJsonNoAnalizable } from './http.js';
import type { FormatoPregunta, PreguntaPropuesta, ResultadoGeneracion } from './proveedor.js';

const LETRAS = ['A', 'B', 'C', 'D', 'E'] as const;
const DIFICULTADES = ['facil', 'media', 'dificil'] as const;

// Lector tolerante: una habilidad inesperada o una cantidad de alternativas distinta no hacen inválida la
// respuesta, son motivos de descarte de la revisión automática (HU-17.1) con su propio motivo.
const esquemaLectura = z.object({
  preguntas: z.array(
    z.object({
      enunciado: z.string(),
      resolucion: z.string(),
      habilidad: z.string(),
      alternativas: z.array(
        z.object({
          letra: z.enum(LETRAS),
          texto: z.string(),
          esCorrecta: z.boolean(),
          explicacion: z.string(),
        }),
      ),
      explicacion: z.string(),
      dificultadSugerida: z.enum(DIFICULTADES),
    }),
  ),
});

/**
 * El JSON Schema que se envía al modelo (responseJsonSchema de Gemini y texto de la instrucción de
 * DeepSeek). Una sola pregunta por llamada. «resolucion» va antes de las alternativas y de la clave: el
 * modelo calcula primero (experimento del 31/10/2026: 4 de 4 claves correctas con este orden frente a 0
 * de 2 sin él). Con formato, fija la cantidad de alternativas y las habilidades de la prueba.
 */
export function esquemaJsonPreguntas(formato?: FormatoPregunta): Record<string, unknown> {
  const letras = formato ? LETRAS.slice(0, formato.alternativas) : LETRAS;
  const habilidades = formato?.habilidades ?? [];
  const propiedades = {
    enunciado: { type: 'string' },
    resolucion: { type: 'string' },
    habilidad: { type: 'string', ...(habilidades.length > 0 && { enum: [...habilidades] }) },
    alternativas: {
      type: 'array',
      ...(formato && { minItems: formato.alternativas, maxItems: formato.alternativas }),
      items: {
        type: 'object',
        properties: {
          letra: { type: 'string', enum: [...letras] },
          texto: { type: 'string' },
          esCorrecta: { type: 'boolean' },
          explicacion: { type: 'string' },
        },
        required: ['letra', 'texto', 'esCorrecta', 'explicacion'],
        additionalProperties: false,
      },
    },
    explicacion: { type: 'string' },
    dificultadSugerida: { type: 'string', enum: [...DIFICULTADES] },
  };
  return {
    type: 'object',
    properties: {
      preguntas: {
        type: 'array',
        minItems: 1,
        maxItems: 1,
        items: {
          type: 'object',
          properties: propiedades,
          required: Object.keys(propiedades),
          additionalProperties: false,
        },
      },
    },
    required: ['preguntas'],
    additionalProperties: false,
  };
}

// Solo formato, sin temario, ejemplos aprobados, cantidades ni criterios pedagógicos.
export const formatoJson = (formato?: FormatoPregunta): string =>
  `Devuelve exclusivamente un objeto JSON con el siguiente esquema: ${JSON.stringify(esquemaJsonPreguntas(formato))}`;

export const cuentaTokens = z.number().int().nonnegative().optional();

export function leerSobre<T>(esquema: z.ZodType<T>, datos: unknown): T {
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) throw new ErrorIARespuestaInvalida();
  return resultado.data;
}

export function leerPreguntas(texto: string | null): PreguntaPropuesta[] {
  if (texto === null || texto.trim() === '') throw new ErrorContenidoVacio();
  let datos: unknown;
  try {
    datos = JSON.parse(texto) as unknown;
  } catch {
    // El mensaje no incluye el texto del modelo. Se reintenta una vez (ver ErrorContenidoReintentable).
    throw new ErrorJsonNoAnalizable();
  }
  return leerSobre(esquemaLectura, datos).preguntas;
}

export function conUsoTokens(uso: ResultadoGeneracion['usoTokens']): Partial<ResultadoGeneracion> {
  if (uso === undefined || Object.values(uso).every((valor) => valor === undefined)) return {};
  return { usoTokens: uso, ...(uso.total !== undefined && { tokensUsados: uso.total }) };
}

export function exigirModelo(modelo: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(modelo)) throw new ErrorIANoDisponible();
  return modelo;
}
