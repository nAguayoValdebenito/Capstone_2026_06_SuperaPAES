// Validación técnica compartida; las reglas pedagógicas pertenecen a HU-17.1.
import { z } from 'zod';
import { ErrorIARespuestaInvalida, ErrorIANoDisponible } from '../../comun/errores.js';
import { ErrorContenidoVacio } from './http.js';
import type { PreguntaPropuesta, ResultadoGeneracion } from './proveedor.js';

const esquemaPreguntas = z.object({
  preguntas: z.array(
    z.object({
      enunciado: z.string(),
      alternativas: z.array(
        z.object({
          letra: z.enum(['A', 'B', 'C', 'D', 'E']),
          texto: z.string(),
          esCorrecta: z.boolean(),
          explicacion: z.string(),
        }),
      ),
      explicacion: z.string(),
      dificultadSugerida: z.enum(['facil', 'media', 'dificil']),
    }),
  ),
});

// Solo formato, sin temario, ejemplos aprobados, cantidades ni criterios pedagógicos.
export const FORMATO_JSON_IA = `Devuelve exclusivamente un objeto JSON con el siguiente esquema: ${JSON.stringify(z.toJSONSchema(esquemaPreguntas))}`;
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
    throw new ErrorIARespuestaInvalida();
  }
  return leerSobre(esquemaPreguntas, datos).preguntas;
}

export function conUsoTokens(uso: ResultadoGeneracion['usoTokens']): Partial<ResultadoGeneracion> {
  if (uso === undefined || Object.values(uso).every((valor) => valor === undefined)) return {};
  return { usoTokens: uso, ...(uso.total !== undefined && { tokensUsados: uso.total }) };
}

export function exigirModelo(modelo: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(modelo)) throw new ErrorIANoDisponible();
  return modelo;
}
