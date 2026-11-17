// Una página de un listado con su total en una sola consulta: la de la página agrega
// `count(*) OVER ()::int AS total` (cuenta todas las filas del filtro antes de LIMIT) y recibe el
// filtro, el límite y el desplazamiento, en ese orden. Si la página pedida queda después de la última y
// no trae filas, el total se pide aparte, con la consulta de conteo y solo el filtro.
import type { QueryResultRow } from 'pg';
import type { Ejecutor } from './transaccion.js';

export interface Pagina<T> {
  filas: T[];
  total: number;
}

export async function paginaConTotal<T extends QueryResultRow>(
  tx: Ejecutor,
  [consulta, conteo]: [string, string],
  filtro: readonly unknown[],
  [limite, desplazamiento]: [number, number],
): Promise<Pagina<T>> {
  const { rows } = await tx.query<T & { total: number }>(consulta, [
    ...filtro,
    limite,
    desplazamiento,
  ]);
  if (rows.length === 0 && desplazamiento > 0) {
    const { rows: conteoFilas } = await tx.query<{ total: number }>(conteo, [...filtro]);
    return { filas: [], total: conteoFilas[0]?.total ?? 0 };
  }
  return {
    filas: rows.map(({ total: _total, ...fila }) => fila as unknown as T),
    total: rows[0]?.total ?? 0,
  };
}
