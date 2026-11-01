// Plantilla de la importación de preguntas (HU-13.1, CU-16, RF-G05): las columnas del archivo de
// preguntas (paso 3) y del archivo de textos de lectura (alternativo 3.a), y la lectura de un archivo
// según su plantilla. Un archivo que no la sigue se rechaza completo con una explicación (2.a); los
// problemas de cada fila los revisa preguntas.importacion.filas.ts.
import { ErrorValidacion } from '../../comun/errores.js';
import { leerCsv, normalizar } from './preguntas.csv.js';
import type { ArchivoCsv } from './preguntas.validadores.js';

/**
 * Una fila por pregunta. Prueba, eje, contenido, habilidad, tipo y dificultad van con sus nombres (o
 * sus códigos); codigo_texto nombra un texto del archivo de textos.
 */
export const COLUMNAS_PREGUNTAS = [
  'prueba',
  'eje',
  'contenido',
  'habilidad',
  'tipo',
  'enunciado',
  'codigo_texto',
  'alternativa_a',
  'alternativa_b',
  'alternativa_c',
  'alternativa_d',
  'alternativa_e',
  'correcta',
  'explicacion',
  'dificultad_sugerida',
  'imagen',
] as const;

/** Un texto de lectura por fila, con el código que usan sus preguntas. */
export const COLUMNAS_TEXTOS = ['codigo', 'tipo_texto', 'titulo', 'contenido'] as const;

export type ColumnaPregunta = (typeof COLUMNAS_PREGUNTAS)[number];
export type ColumnaTexto = (typeof COLUMNAS_TEXTOS)[number];

export interface FilaDelArchivo<C extends string> {
  /** Número de la fila en la planilla: la 1 es la de las columnas. */
  numero: number;
  celdas: Record<C, string>;
  /** La fila no tiene nada escrito: se omite. */
  enBlanco: boolean;
  /** Trae más celdas que columnas: un separador sin comillas corrió las demás. */
  sobran: boolean;
}

const CARACTER_DE_REEMPLAZO = String.fromCodePoint(0xfffd);

/** «Alternativa A» o «alternativa_a»: los encabezados se comparan sin tildes ni mayúsculas. */
const nombreDeColumna = (encabezado: string) => normalizar(encabezado).replaceAll(' ', '_');

function rechazar(archivo: ArchivoCsv, motivo: string): ErrorValidacion {
  const mensaje = `El archivo «${archivo.nombre}» no sigue la plantilla: ${motivo}`;
  return new ErrorValidacion([{ lugar: 'cuerpo', ruta: 'archivo', mensaje }], mensaje);
}

/** Lo que tienen de más, de menos o repetido los encabezados; null si son los de la plantilla. */
function problemaDeColumnas(encabezados: readonly string[], columnas: readonly string[]) {
  const vistas = new Set<string>();
  for (const encabezado of encabezados.filter(Boolean)) {
    if (vistas.has(encabezado)) return `la columna «${encabezado}» está repetida.`;
    if (!columnas.includes(encabezado)) return `la columna «${encabezado}» no es de la plantilla.`;
    vistas.add(encabezado);
  }
  const faltan = columnas.filter((columna) => !vistas.has(columna));
  if (faltan.length === 0) return null;
  return `faltan las columnas ${faltan.map((columna) => `«${columna}»`).join(', ')}.`;
}

/** Las filas del texto, o el motivo por el que el archivo no se puede leer. */
function filasDe(archivo: ArchivoCsv): string[][] | string {
  // La consola lee el archivo como UTF-8: un archivo en otra codificación llega con el carácter de
  // reemplazo (U+FFFD) en lugar de las tildes.
  if (archivo.contenido.includes(CARACTER_DE_REEMPLAZO)) {
    return 'no está en UTF-8. Guárdalo como «CSV UTF-8 (delimitado por comas)».';
  }
  const filas = leerCsv(archivo.contenido);
  if (!filas) return 'tiene comillas sin cerrar o mal puestas.';
  if (filas.length < 2) return 'no tiene filas después de la de las columnas.';
  return filas;
}

/**
 * Las filas del archivo, con sus celdas por columna. Lanza ErrorValidacion si el archivo no se puede
 * leer o sus columnas no son las de la plantilla (CU-16 2.a): así no se importa nada a medias.
 */
export function leerArchivo<C extends string>(
  archivo: ArchivoCsv,
  columnas: readonly C[],
): FilaDelArchivo<C>[] {
  const filas = filasDe(archivo);
  if (typeof filas === 'string') throw rechazar(archivo, filas);
  const encabezados = (filas[0] ?? []).map(nombreDeColumna);
  const problema = problemaDeColumnas(encabezados, columnas);
  if (problema) throw rechazar(archivo, problema);
  return filas.slice(1).map((celdas, i) => {
    const porColumna = Object.fromEntries(columnas.map((columna) => [columna, ''])) as Record<
      C,
      string
    >;
    encabezados.forEach((encabezado, j) => {
      if (encabezado) porColumna[encabezado as C] = (celdas[j] ?? '').trim();
    });
    return {
      numero: i + 2,
      celdas: porColumna,
      enBlanco: celdas.every((celda) => !celda.trim()),
      sobran: celdas.slice(encabezados.length).some((celda) => celda.trim() !== ''),
    };
  });
}
