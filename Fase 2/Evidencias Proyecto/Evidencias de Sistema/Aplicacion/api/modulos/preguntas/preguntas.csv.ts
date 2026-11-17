// Lectura de los archivos CSV de la importación (HU-13.1, RF-G05): texto UTF-8 separado por comas o por
// punto y coma (Excel en español guarda con «;»), con comillas dobles en los campos que llevan el
// separador, saltos de línea o comillas (RFC 4180). Solo convierte el texto en filas de celdas: qué
// columnas debe tener cada archivo lo decide preguntas.plantilla.ts.
import { normalizarParaComparar } from '../../comun/contrasenas.js';

/** Quita tildes, mayúsculas y espacios de más: así se comparan columnas y nombres del temario. */
export function normalizar(texto: string): string {
  return normalizarParaComparar(texto).replace(/\s+/g, ' ');
}

/** El separador del archivo: el que más aparece en la primera línea, que es la de las columnas. */
function separadorDe(texto: string): string {
  const primera = texto.split(/\r?\n/, 1)[0] ?? '';
  const veces = (letra: string) => primera.split(letra).length;
  return veces(';') > veces(',') ? ';' : ',';
}

const esFinDeCelda = (letra: string | undefined, separador: string) =>
  letra === undefined || letra === separador || letra === '\n' || letra === '\r';

/** Una celda entre comillas desde `desde` (la comilla que abre); null si no se cierra bien. */
function celdaEntreComillas(
  texto: string,
  desde: number,
  separador: string,
): { celda: string; fin: number } | null {
  let celda = '';
  let i = desde + 1;
  for (;;) {
    const cierre = texto.indexOf('"', i);
    if (cierre === -1) return null;
    celda += texto.slice(i, cierre);
    // Dos comillas seguidas son una comilla dentro de la celda.
    if (texto[cierre + 1] !== '"') {
      return esFinDeCelda(texto[cierre + 1], separador) ? { celda, fin: cierre + 1 } : null;
    }
    celda += '"';
    i = cierre + 2;
  }
}

/** La celda que empieza en `desde` y la posición donde termina; null si sus comillas están mal. */
function leerCelda(
  texto: string,
  desde: number,
  separador: string,
): { celda: string; fin: number } | null {
  if (texto[desde] === '"') return celdaEntreComillas(texto, desde, separador);
  let fin = desde;
  while (!esFinDeCelda(texto[fin], separador)) fin += 1;
  return { celda: texto.slice(desde, fin), fin };
}

const MARCA_UTF8 = String.fromCodePoint(0xfeff);

export const filaEnBlanco = (fila: readonly string[]) => fila.every((celda) => !celda.trim());

/**
 * Sin las filas en blanco del final: el último salto de línea y las que Excel deja con solo
 * separadores no son filas del archivo.
 */
function sinBlancosAlFinal(filas: string[][]): string[][] {
  let fin = filas.length;
  while (fin > 0 && filaEnBlanco(filas[fin - 1] ?? [])) fin -= 1;
  return filas.slice(0, fin);
}

/** Las filas del archivo con sus celdas tal como vienen, o null si hay comillas sin cerrar o mal puestas. */
export function leerCsv(contenido: string): string[][] | null {
  // Excel antepone la marca de orden de bytes (U+FEFF) al guardar como «CSV UTF-8».
  const texto = contenido.replace(new RegExp(`^${MARCA_UTF8}`), '');
  const separador = separadorDe(texto);
  const filas: string[][] = [];
  let fila: string[] = [];
  let i = 0;
  for (;;) {
    const leida = leerCelda(texto, i, separador);
    if (!leida) return null;
    fila.push(leida.celda);
    i = leida.fin + 1;
    if (texto[leida.fin] === separador) continue;
    filas.push(fila);
    fila = [];
    if (leida.fin >= texto.length) break;
    if (texto[leida.fin] === '\r' && texto[i] === '\n') i += 1;
  }
  return sinBlancosAlFinal(filas);
}
