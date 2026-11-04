// HU-52: catálogo administrable, separado de la trazabilidad HU-56 del mismo módulo.
import { solicitarAdmin } from '../api/cliente';
import type { DatosPlanes, EdicionPlan, PlanAdministrable } from '../tipos/planes';

const RUTA = '/suscripciones/planes';

export async function listarPlanes(senal: AbortSignal): Promise<DatosPlanes> {
  return (await solicitarAdmin<DatosPlanes>(RUTA, { signal: senal })).data;
}

export async function editarPlan(id: number, datos: EdicionPlan): Promise<PlanAdministrable> {
  return (
    await solicitarAdmin<PlanAdministrable>(`${RUTA}/${String(id)}`, {
      method: 'PUT',
      body: JSON.stringify(datos),
    })
  ).data;
}
