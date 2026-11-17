// La consulta y la paginación de un listado de la API ({ pagina, porPagina, total } en meta), compartidas
// por los servicios que listan de a páginas (banco de preguntas, suscripciones).
import type { Paginacion } from '../tipos';

/** La consulta (?campo=valor&pagina=2) con solo los filtros con valor, y la página si no es la primera. */
export function consultaDeListado(filtros: object, pagina: number): string {
  const parametros = new URLSearchParams();
  for (const [campo, valor] of Object.entries(filtros) as [string, unknown][]) {
    if (typeof valor === 'number' || (typeof valor === 'string' && valor !== ''))
      parametros.set(campo, String(valor));
  }
  if (pagina > 1) parametros.set('pagina', String(pagina));
  const texto = parametros.toString();
  return texto ? `?${texto}` : '';
}

/** Páginas de un listado (al menos una). */
export function totalDePaginas({ total, porPagina }: Paginacion): number {
  return porPagina > 0 ? Math.max(1, Math.ceil(total / porPagina)) : 1;
}

/** La paginación de meta; si no viene, una sola página con lo que llegó. */
export function paginacionDe(meta: unknown, pagina: number, cantidad: number): Paginacion {
  const { pagina: actual, porPagina, total } = (meta ?? {}) as Record<string, unknown>;
  return typeof actual === 'number' && typeof porPagina === 'number' && typeof total === 'number'
    ? { pagina: actual, porPagina, total }
    : { pagina, porPagina: cantidad, total: cantidad };
}
