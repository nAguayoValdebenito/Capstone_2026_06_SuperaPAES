// Cálculos de C08 · Evaluaciones: textos de la tabla, suma del reparto y lectura de la tabla del DEMRE pegada.
import type {
  EdicionEstructura,
  Estructura,
  FilaConversion,
  FilaReparto,
  NuevaTabla,
} from '../tipos/evaluaciones';

const guionSi = (valor: number | null, formato: (valor: number) => string = String) =>
  valor === null || valor === 0 ? '—' : formato(valor);

/** Los valores de una fila de la tabla de estructuras. */
export const preguntasDe = ({ cantidadMin, cantidadMax }: Estructura) =>
  cantidadMin === cantidadMax
    ? String(cantidadMax)
    : `${String(cantidadMin)} a ${String(cantidadMax)}`;

export const tiempoDe = ({ duracionMin }: Estructura) =>
  guionSi(duracionMin, (minutos) => `${String(minutos)} min`);

export const textosDe = ({ textos }: Estructura) => guionSi(textos);

export const gratisDe = ({ usosGratisMes }: Estructura) => guionSi(usosGratisMes);

export const sumaDelReparto = (cantidades: readonly number[]) =>
  cantidades.reduce((suma, cantidad) => suma + cantidad, 0);

/** Las cantidades del formulario, por fila del reparto. */
export const cantidadesDe = (reparto: readonly FilaReparto[]) =>
  Object.fromEntries(reparto.map(({ id, cantidad }) => [id, String(cantidad)]));

export interface CamposEstructura {
  minimo: string;
  maximo: string;
  noPuntuan: string;
  tiempo: string | null;
  textos: string | null;
  gratis: string;
  cantidades: Record<string, string>;
}

/** Lo que se edita: lo que es null (sin tiempo, sin textos) no se muestra y sigue en null. */
export const camposDe = (estructura: Estructura): CamposEstructura => ({
  minimo: String(estructura.cantidadMin),
  maximo: String(estructura.cantidadMax),
  noPuntuan: String(estructura.noPuntuables),
  tiempo: estructura.duracionMin?.toString() ?? null,
  textos: estructura.textos?.toString() ?? null,
  gratis: String(estructura.usosGratisMes),
  cantidades: cantidadesDe(estructura.reparto),
});

const opcional = (valor: string | null) => (valor === null ? null : Number(valor));

/** Lo que va a la API. Una evaluación con reparto tiene una sola cantidad de preguntas. */
export function edicionDe({ reparto }: Estructura, campos: CamposEstructura): EdicionEstructura {
  return {
    cantidadMin: Number(reparto.length > 0 ? campos.maximo : campos.minimo),
    cantidadMax: Number(campos.maximo),
    noPuntuables: Number(campos.noPuntuan),
    duracionMin: opcional(campos.tiempo),
    textos: opcional(campos.textos),
    usosGratisMes: Number(campos.gratis),
    reparto: reparto.map(({ id }) => ({ id, cantidad: Number(campos.cantidades[id]) })),
  };
}

export interface CamposTabla {
  anio: string;
  procesoId: number | undefined;
  electivoId?: number | undefined;
  publicadaEn: string;
}

/** Los datos de la tabla listos para enviar, o qué falta. */
export function problemaDeLaCarga(
  { anio, procesoId, electivoId, publicadaEn }: CamposTabla,
  conElectivos: boolean,
): string | Omit<NuevaTabla, 'pruebaId' | 'filas'> {
  if (procesoId === undefined || publicadaEn === '') {
    return 'Indica el proceso y la fecha de publicación.';
  }
  if (conElectivos && electivoId === undefined) return 'Elige el electivo.';
  return {
    procesoId,
    anioAdmision: Number(anio),
    electivoAreaId: electivoId ?? null,
    publicadaEn,
  };
}

export type TablaLeida = { filas: FilaConversion[] } | { error: string };

/** Lee una fila por línea: correctas y puntaje, separados por coma, punto y coma o tabulación (Excel). */
export function leerTabla(texto: string): TablaLeida {
  const lineas = texto
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter((linea) => linea !== '');
  if (lineas.length === 0) return { error: 'Pega la tabla: una línea por cantidad de correctas.' };
  const filas: FilaConversion[] = [];
  for (const [indice, linea] of lineas.entries()) {
    const partes = /^(\d+)\s*[,;\t]\s*(\d+)$/.exec(linea);
    if (!partes) {
      return { error: `La línea ${String(indice + 1)} debe tener correctas y puntaje.` };
    }
    filas.push({ correctas: Number(partes[1]), puntaje: Number(partes[2]) });
  }
  return { filas };
}
