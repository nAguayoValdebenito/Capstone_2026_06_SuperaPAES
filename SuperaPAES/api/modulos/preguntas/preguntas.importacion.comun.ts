// Piezas comunes de la revisión de las filas importadas (HU-13.1): el error de una fila para la tabla
// de C04, el buscador por nombre o código en las listas del temario y la validación con los esquemas del
// formulario (HU-12). Las usan preguntas.importacion.filas.ts y preguntas.importacion.textos.ts.
import type { z } from 'zod';
import { normalizar } from './preguntas.csv.js';
import type { DatosTexto } from './preguntas.validadores.js';

/** Una fila que no se importa, con sus motivos (la tabla «Filas con errores» de C04). */
export interface ErrorDeFila {
  archivo: 'preguntas' | 'textos';
  fila: number;
  /** Comienzo del enunciado o el título del texto, para reconocer la fila. */
  resumen: string;
  motivos: string[];
}

/** Un texto del archivo de textos; sin datos si su fila tiene errores. */
export interface TextoDelArchivo {
  fila: number;
  codigo: string;
  datos: DatosTexto | null;
}

const LARGO_RESUMEN = 80;

export const MOTIVO_SOBRAN =
  'Tiene más celdas que columnas: revisa las comillas de los textos con «;» o «,».';

/** Los motivos de una lista armada con condiciones: quedan los textos no vacíos. */
export const esMotivo = (motivo: unknown): motivo is string =>
  typeof motivo === 'string' && motivo !== '';

export function resumir(texto: string): string {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  return limpio.length > LARGO_RESUMEN ? `${limpio.slice(0, LARGO_RESUMEN - 1)}…` : limpio;
}

type Nombrada = { nombre: string; codigo?: string };

/** La opción de la lista que se llama como `valor` o tiene ese código, sin mirar tildes ni mayúsculas. */
export type Buscar = <T extends Nombrada>(lista: readonly T[], valor: string) => T | undefined;

function indiceDe<T extends Nombrada>(lista: readonly T[]): Map<string, T> {
  const indice = new Map<string, T>();
  // Como find: si dos opciones se llaman igual, queda la primera.
  for (const opcion of lista) {
    for (const clave of [opcion.nombre, opcion.codigo ?? '']) {
      const normalizada = normalizar(clave);
      if (normalizada && !indice.has(normalizada)) indice.set(normalizada, opcion);
    }
  }
  return indice;
}

/**
 * Un buscador para una revisión: cada lista (pruebas, ejes, contenidos, habilidades, tipos,
 * dificultades) se normaliza una sola vez y no una vez por fila. Vive lo que dura la revisión.
 */
export function crearBuscador(): Buscar {
  const indices = new Map<object, Map<string, unknown>>();
  return <T extends Nombrada>(lista: readonly T[], valor: string) => {
    let indice = indices.get(lista) as Map<string, T> | undefined;
    if (!indice) {
      indice = indiceDe(lista);
      indices.set(lista, indice);
    }
    return indice.get(normalizar(valor));
  };
}

/** «Falta el eje.» si la celda está vacía, o que el valor no existe. */
export const faltaONoExiste = (valor: string, falta: string, noExiste: string) =>
  valor ? noExiste : falta;

/**
 * La fila ya armada pasa además por el esquema del formulario (HU-12): una regla que se agregue ahí
 * (un largo, un formato) rige también al importar.
 */
export function conEsquema<T>(
  esquema: { safeParse(valor: unknown): z.ZodSafeParseResult<T> },
  valor: unknown,
): { datos: T } | { motivos: string[] } {
  const resultado = esquema.safeParse(valor);
  return resultado.success
    ? { datos: resultado.data }
    : { motivos: resultado.error.issues.map((problema) => problema.message) };
}
