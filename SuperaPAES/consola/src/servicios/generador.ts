// Llamadas a /api/v1/admin/generador (módulo generador de la API): pedir un lote y ver su avance.
import { solicitarAdmin } from '../api/cliente';
import type { Lote, PaginaLotes, PedidoLote } from '../tipos/generador';
import { consultaDeListado, paginacionDe } from './paginacion';

const LOTES = '/generador/lotes';

/** HU-16.2: el lote queda en la cola; si ya había uno idéntico pendiente, la API devuelve ese. */
export async function pedirLote(pedido: PedidoLote): Promise<Lote> {
  const { data } = await solicitarAdmin<Lote>(LOTES, {
    method: 'POST',
    body: JSON.stringify(pedido),
  });
  return data;
}

/** HU-16.3: los lotes, del más reciente al más antiguo. */
export async function listarLotes(pagina: number, senal: AbortSignal): Promise<PaginaLotes> {
  const { data, meta } = await solicitarAdmin<Lote[]>(`${LOTES}${consultaDeListado({}, pagina)}`, {
    signal: senal,
  });
  return { lotes: data, paginacion: paginacionDe(meta, pagina, data.length) };
}
