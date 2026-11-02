// Llamadas a /api/v1/admin/revision (módulo revision de la API): bandeja de revisión, desempates y clasificación de dificultad.
// Cada función usa solicitarAdmin() de ../api/cliente.
import { solicitarAdmin } from '../api/cliente';
import type {
  DatosRevision,
  EnvioARevision,
  PreguntaARevisar,
  RevisionEntregada,
  RevisionPendiente,
} from '../tipos';

const MIS_REVISIONES = '/revision/mis-revisiones';

const opciones = (senal?: AbortSignal) => (senal ? { signal: senal } : {});

/** HU-21: pasa la pregunta a en revisión y le asigna sus revisores (RN-10). */
export async function enviarARevision(preguntaId: number): Promise<EnvioARevision> {
  const { data } = await solicitarAdmin<EnvioARevision>(
    `/revision/preguntas/${String(preguntaId)}`,
    { method: 'POST' },
  );
  return data;
}

/** HU-22: la bandeja del docente, la fecha límite más próxima primero. */
export async function listarMisRevisiones(senal?: AbortSignal): Promise<RevisionPendiente[]> {
  const { data } = await solicitarAdmin<RevisionPendiente[]>(MIS_REVISIONES, opciones(senal));
  return data;
}

/** HU-22: la pregunta a ciegas, con la pauta y las opciones. */
export async function obtenerMiRevision(
  id: number,
  senal?: AbortSignal,
): Promise<PreguntaARevisar> {
  const { data } = await solicitarAdmin<PreguntaARevisar>(
    `${MIS_REVISIONES}/${String(id)}`,
    opciones(senal),
  );
  return data;
}

/** HU-22 y CU-19: entrega la revisión con la pauta, la dificultad y la decisión. */
export async function entregarRevision(
  id: number,
  datos: DatosRevision,
): Promise<RevisionEntregada> {
  const { data } = await solicitarAdmin<RevisionEntregada>(`${MIS_REVISIONES}/${String(id)}`, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
  return data;
}
