// Llamadas a /api/v1/admin/temario (módulo temario de la API): áreas, pruebas, habilidades, ejes y contenidos del temario.
// Cada función usa solicitarAdmin() de ../api/cliente.
import { solicitarAdmin } from '../api/cliente';
import type { Area } from '../tipos';

/** Áreas de especialidad de los docentes, ordenadas por nombre. */
export async function listarAreas(senal?: AbortSignal): Promise<Area[]> {
  const { data } = await solicitarAdmin<Area[]>('/temario/areas', senal ? { signal: senal } : {});
  return data;
}
