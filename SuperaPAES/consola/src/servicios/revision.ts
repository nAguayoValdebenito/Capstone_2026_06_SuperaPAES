// Llamadas a /api/v1/admin/revision (módulo revision de la API): bandeja de revisión, desempates y clasificación de dificultad.
// Cada función usa solicitarAdmin() de ../api/cliente.
import { solicitarAdmin } from '../api/cliente';
import type { EnvioARevision } from '../tipos';

/** HU-21: pasa la pregunta a en revisión y le asigna sus revisores (RN-10). */
export async function enviarARevision(preguntaId: number): Promise<EnvioARevision> {
  const { data } = await solicitarAdmin<EnvioARevision>(
    `/revision/preguntas/${String(preguntaId)}`,
    { method: 'POST' },
  );
  return data;
}
