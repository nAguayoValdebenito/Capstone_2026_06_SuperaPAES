// Llamadas a /api/v1/admin/preguntas (módulo preguntas de la API): banco de preguntas, importaciones y avisos de error de los estudiantes.
// Cada función usa solicitarAdmin() de ../api/cliente.
import { solicitarAdmin } from '../api/cliente';
import type {
  FiltrosBanco,
  OpcionesFiltrosBanco,
  PaginaDelBanco,
  Paginacion,
  PreguntaDelBanco,
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
