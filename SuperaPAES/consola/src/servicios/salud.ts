// Consulta el estado de la API y de la base de datos (GET /api/v1/salud).
import { solicitar } from '../api/cliente';
import type { EstadoSalud } from '../tipos';

export async function obtenerSalud(senal?: AbortSignal): Promise<EstadoSalud> {
  const { data } = await solicitar<EstadoSalud>('/salud', senal ? { signal: senal } : {});
  return data;
}
