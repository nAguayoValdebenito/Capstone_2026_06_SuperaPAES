// Enviar a revisión hasta 10 preguntas por vez (C02, HU-21, CU-18), para llenar la app de pruebas más
// rápido. No cambia las reglas: cada pregunta pasa por el mismo envío de una (RN-10, dos docentes de su
// área, cada una en su transacción y con su auditoría). Si una no se puede enviar (no está en borrador u
// observada, o su área no tiene docentes), sigue con las demás y dice por qué.
import { ErrorAplicacion } from '../../comun/errores.js';
import { MAXIMO_LOTE_REVISION } from './revision.validadores.js';

/** Una pregunta que no se envió y por qué. */
export interface PreguntaNoEnviada {
  id: string;
  motivo: string;
}

export interface LoteARevision<E> {
  enviadas: E[];
  noEnviadas: PreguntaNoEnviada[];
}

/** El motivo de una regla del sistema; un error inesperado se vuelve a lanzar. */
function motivoDe(error: unknown): string {
  if (error instanceof ErrorAplicacion) return error.message;
  throw error;
}

/** Envía de a una, en orden, con `enviar` (el envío de una pregunta). */
export async function enviarLoteARevision<E>(
  enviar: (preguntaId: string) => Promise<E>,
  ids: readonly string[],
): Promise<LoteARevision<E>> {
  const resultado: LoteARevision<E> = { enviadas: [], noEnviadas: [] };
  for (const id of ids.slice(0, MAXIMO_LOTE_REVISION)) {
    try {
      resultado.enviadas.push(await enviar(id));
    } catch (error) {
      resultado.noEnviadas.push({ id, motivo: motivoDe(error) });
    }
  }
  return resultado;
}
