// Archivos CSV de la importación de preguntas (HU-13.1) para las pruebas: la plantilla con sus columnas
// y filas armadas a partir de una pregunta base, con las celdas que cambian, el archivo de CP-10 y las
// llamadas para revisar e importar como administrador.
import request from 'supertest';
import { COLUMNAS_PREGUNTAS, COLUMNAS_TEXTOS } from '../modulos/preguntas/preguntas.plantilla.js';
import { comoAdmin, type escenarioEdicion } from './edicion-de-prueba.js';

export const RUTA_IMPORTACIONES = '/api/v1/admin/preguntas/importaciones';

type FilaPregunta = Partial<Record<(typeof COLUMNAS_PREGUNTAS)[number], string>>;
type FilaTexto = Partial<Record<(typeof COLUMNAS_TEXTOS)[number], string>>;

/** Pregunta de M1 válida del temario en memoria (edicion-de-prueba.ts). */
export const PREGUNTA_M1: FilaPregunta = {
  prueba: 'Competencia Matemática 1',
  eje: 'Álgebra',
  contenido: 'Ecuaciones',
  habilidad: 'Resolver problemas',
  tipo: 'Selección múltiple',
  enunciado: 'Si $2x + 3 = 11$, ¿cuánto vale $x$?',
  alternativa_a: '2',
  alternativa_b: '4',
  alternativa_c: '6',
  alternativa_d: '8',
  correcta: 'B',
  explicacion: 'Se despeja: $x = 4$.',
  dificultad_sugerida: 'Media',
};

/** Una celda con el separador, comillas o saltos de línea va entre comillas, con las comillas dobladas. */
const celda = (valor: string, separador: string) =>
  /["\r\n]/.test(valor) || valor.includes(separador) ? `"${valor.replaceAll('"', '""')}"` : valor;

function csv(columnas: readonly string[], filas: Record<string, string>[], separador: string) {
  const lineas = filas.map((fila) =>
    columnas.map((columna) => celda(fila[columna] ?? '', separador)).join(separador),
  );
  return [columnas.join(separador), ...lineas].join('\r\n') + '\r\n';
}

/**
 * Archivo de preguntas: cada fila es la pregunta base con sus cambios; null es una fila en blanco. Va
 * con «;», como lo guarda Excel en español.
 */
export function csvPreguntas(
  filas: (FilaPregunta | null)[],
  { base = PREGUNTA_M1, separador = ';' }: { base?: FilaPregunta; separador?: string } = {},
): string {
  return csv(
    COLUMNAS_PREGUNTAS,
    filas.map((fila) => (fila === null ? {} : { ...base, ...fila }) as Record<string, string>),
    separador,
  );
}

export function csvTextos(filas: FilaTexto[]): string {
  return csv(COLUMNAS_TEXTOS, filas, ';');
}

/** Cuerpo para revisar o importar: el archivo de preguntas y, si hay, el de textos. */
export function archivos(preguntas: string, textos: string | null = null) {
  return {
    preguntas: { nombre: 'preguntas.csv', contenido: preguntas },
    textos: textos === null ? null : { nombre: 'textos.csv', contenido: textos },
  };
}

type App = ReturnType<typeof escenarioEdicion>['app'];

export async function revisar(app: App, cuerpo: unknown) {
  return request(app)
    .post(`${RUTA_IMPORTACIONES}/revision`)
    .set(await comoAdmin())
    .send(cuerpo as object);
}

export async function importar(app: App, cuerpo: object) {
  return request(app)
    .post(RUTA_IMPORTACIONES)
    .set(await comoAdmin())
    .send(cuerpo);
}

/** CP-10: dos filas válidas, una en blanco, una sin correcta y una con un contenido fuera del temario. */
export const ARCHIVO_CP10 = csvPreguntas([
  {},
  null,
  { correcta: '', enunciado: 'Sin correcta' },
  { contenido: 'Trigonometría', enunciado: 'Fuera del temario' },
  {
    prueba: 'M2',
    eje: 'Probabilidad',
    contenido: 'Binomial',
    habilidad: 'Modelar',
    alternativa_e: '10',
    correcta: 'e',
  },
]);
