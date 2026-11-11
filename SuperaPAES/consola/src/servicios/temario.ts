// Llamadas a /api/v1/admin/temario (módulo temario de la API): áreas, pruebas, habilidades, ejes y contenidos del temario.
// Cada función usa solicitarAdmin() de ../api/cliente.
import { solicitarAdmin } from '../api/cliente';
import type { Area } from '../tipos';
import type { ConsultaTemario } from '../tipos/temario';

/** C07: lo que está cargado en la base, sin cambiar ni importar contenido. */
export async function consultarTemario(senal?: AbortSignal): Promise<ConsultaTemario> {
  const { data } = await solicitarAdmin<ConsultaTemario>(
    '/temario',
    senal ? { signal: senal } : {},
  );
  return data;
}

/** Áreas de especialidad de los docentes, ordenadas por nombre. */
export async function listarAreas(senal?: AbortSignal): Promise<Area[]> {
  const { data } = await solicitarAdmin<Area[]>('/temario/areas', senal ? { signal: senal } : {});
  return data;
}
