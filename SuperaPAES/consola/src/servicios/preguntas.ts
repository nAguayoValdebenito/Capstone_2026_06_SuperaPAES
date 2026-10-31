// Llamadas a /api/v1/admin/preguntas (módulo preguntas de la API): banco de preguntas, importaciones y avisos de error de los estudiantes.
// Cada función usa solicitarAdmin() de ../api/cliente.
import { solicitarAdmin } from '../api/cliente';
import type {
  DatosPregunta,
  FiltrosBanco,
  Opcion,
  OpcionesFiltrosBanco,
  PaginaDelBanco,
  Paginacion,
  PreguntaDelBanco,
  PreguntaParaEditar,
  TextoDeLectura,
} from '../tipos';

const PREGUNTAS = '/preguntas';

const opciones = (senal?: AbortSignal) => (senal ? { signal: senal } : {});

/** Consulta del banco: solo los filtros con valor, y la página. */
export function consultaDelBanco(filtros: FiltrosBanco, pagina: number): string {
  const parametros = new URLSearchParams();
  for (const [campo, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== '') parametros.set(campo, String(valor));
  }
  if (pagina > 1) parametros.set('pagina', String(pagina));
  const texto = parametros.toString();
  return texto ? `?${texto}` : '';
}

function esPaginacion(meta: unknown): meta is Paginacion {
  const { pagina, porPagina, total } = (meta ?? {}) as Record<string, unknown>;
  return [pagina, porPagina, total].every((n) => typeof n === 'number');
}

/** HU-11: una página del banco con los filtros elegidos. */
export async function listarBanco(
  filtros: FiltrosBanco,
  pagina: number,
  senal?: AbortSignal,
): Promise<PaginaDelBanco> {
  const { data, meta } = await solicitarAdmin<PreguntaDelBanco[]>(
    `${PREGUNTAS}${consultaDelBanco(filtros, pagina)}`,
    opciones(senal),
  );
  const paginacion = esPaginacion(meta)
    ? meta
    : { pagina, porPagina: data.length, total: data.length };
  return { preguntas: data, paginacion };
}

export async function obtenerFiltrosBanco(senal?: AbortSignal): Promise<OpcionesFiltrosBanco> {
  const { data } = await solicitarAdmin<OpcionesFiltrosBanco>(
    `${PREGUNTAS}/filtros`,
    opciones(senal),
  );
  return data;
}

/** HU-12.1: la pregunta con su correcta, para editarla. */
export async function obtenerPregunta(
  id: number,
  senal?: AbortSignal,
): Promise<PreguntaParaEditar> {
  const { data } = await solicitarAdmin<PreguntaParaEditar>(
    `${PREGUNTAS}/${String(id)}`,
    opciones(senal),
  );
  return data;
}

/** HU-12.1: la pregunta nueva queda en borrador. */
export async function crearPregunta(datos: DatosPregunta): Promise<PreguntaParaEditar> {
  const { data } = await solicitarAdmin<PreguntaParaEditar>(PREGUNTAS, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
  return data;
}

/** HU-12.1 y RF-G09: solo en borrador u observada. */
export async function editarPregunta(
  id: number,
  datos: DatosPregunta,
): Promise<PreguntaParaEditar> {
  const { data } = await solicitarAdmin<PreguntaParaEditar>(`${PREGUNTAS}/${String(id)}`, {
    method: 'PUT',
    body: JSON.stringify(datos),
  });
  return data;
}

/** HU-12.2: textos de lectura guardados; la búsqueda es por título. */
export async function listarTextos(buscar: string, senal?: AbortSignal): Promise<TextoDeLectura[]> {
  const consulta = buscar.trim()
    ? `?${new URLSearchParams({ buscar: buscar.trim() }).toString()}`
    : '';
  const { data } = await solicitarAdmin<TextoDeLectura[]>(
    `${PREGUNTAS}/textos${consulta}`,
    opciones(senal),
  );
  return data;
}

export async function listarTiposDeTexto(senal?: AbortSignal): Promise<Opcion[]> {
  const { data } = await solicitarAdmin<Opcion[]>(`${PREGUNTAS}/textos/tipos`, opciones(senal));
  return data;
}
