import { solicitarAdmin } from '../api/cliente';
import type {
  ConsultaSaldo,
  NuevaTarifa,
  SaldoDocente,
  TarifaRevision,
  TarifasDocentes,
} from '../tipos/saldo';
import { paginacionDe } from './paginacion';

export async function consultarSaldo(
  docenteId: number | null,
  filtros: ConsultaSaldo,
  pagina: number,
  signal?: AbortSignal,
): Promise<SaldoDocente> {
  const consulta = new URLSearchParams({ pagina: String(pagina), ...filtros });
  const ruta = docenteId === null ? '/revision/mi-saldo' : `/revision/saldos/${String(docenteId)}`;
  const { data, meta } = await solicitarAdmin<Omit<SaldoDocente, 'paginacion'>>(
    `${ruta}?${consulta.toString()}`,
    signal ? { signal } : {},
  );
  return { ...data, paginacion: paginacionDe(meta, pagina, data.detalle.length) };
}
export async function consultarTarifas(signal?: AbortSignal): Promise<TarifasDocentes> {
  return (await solicitarAdmin<TarifasDocentes>('/revision/tarifas', signal ? { signal } : {}))
    .data;
}
export async function registrarTarifa(datos: NuevaTarifa): Promise<TarifaRevision> {
  return (
    await solicitarAdmin<TarifaRevision>('/revision/tarifas', {
      method: 'POST',
      body: JSON.stringify(datos),
    })
  ).data;
}
