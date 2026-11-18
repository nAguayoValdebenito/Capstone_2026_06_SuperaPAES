// Enviar a revisión de 10 en 10 (C02, HU-21, CU-18), para llenar la app de pruebas más rápido. Cada clic
// toma las preguntas en borrador u observadas que cumplen los filtros del banco, en todo el banco y las
// más antiguas primero, y envía 10; el clic siguiente envía las 10 siguientes, hasta que no quede
// ninguna. No cambia las reglas: cada pregunta pasa por el mismo envío de una (RN-10, dos docentes de su
// área, en su transacción y con su auditoría). Si una no se puede enviar (por ejemplo, su área no tiene
// docentes), sigue con las demás (revisa hasta 50 por clic) y dice por qué.
import { ErrorAplicacion } from '../../comun/errores.js';

/** Lo que se envía en un clic. */
export const MAXIMO_LOTE_REVISION = 10;
/** Las que se revisan como mucho en un clic, por si algunas no se pueden enviar. */
export const CANDIDATAS_POR_LOTE = 50;

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

/** Envía en orden con `enviar` (el envío de una pregunta) hasta completar 10. */
export async function enviarLoteARevision<E>(
  enviar: (preguntaId: string) => Promise<E>,
  candidatas: readonly string[],
): Promise<LoteARevision<E>> {
  const resultado: LoteARevision<E> = { enviadas: [], noEnviadas: [] };
  for (const id of candidatas) {
    if (resultado.enviadas.length === MAXIMO_LOTE_REVISION) break;
    try {
      resultado.enviadas.push(await enviar(id));
    } catch (error) {
      resultado.noEnviadas.push({ id, motivo: motivoDe(error) });
    }
  }
  return resultado;
}
