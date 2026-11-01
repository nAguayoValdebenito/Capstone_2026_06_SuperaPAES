// SQL de las lecturas del banco para el generador con IA (HU-16.2 y HU-17.2). Solo lecturas, parametrizadas.
import type { Ejecutor } from '../../db/transaccion.js';

/** Una pregunta ya aprobada que se le muestra a la IA como ejemplo de lo que se espera. */
export interface EjemploDePregunta {
  enunciado: string;
  alternativas: { letra: string; texto: string; esCorrecta: boolean }[];
}

// Ejemplos: aprobadas o publicadas, de origen manual o IA. Las importadas quedan fuera (RN-29): no se
// sabe de dónde vienen y no deben servir de modelo para la IA.
const EJEMPLOS = `
  SELECT p.id, p.enunciado
    FROM contenido.pregunta p
    JOIN contenido.estado_pregunta e ON e.id = p.estado_pregunta_id
   WHERE p.contenido_id = $1 AND p.importacion_id IS NULL AND e.codigo IN ('aprobada', 'publicada')
   ORDER BY p.id DESC
   LIMIT $2`;

export function crearPreguntasGeneracionRepositorio(bd: Ejecutor) {
  return {
    /** Los enunciados del contenido en cualquier estado, también rechazadas y retiradas. */
    async enunciadosDelContenido(contenidoId: number, tx: Ejecutor = bd): Promise<string[]> {
      const { rows } = await tx.query<{ enunciado: string }>(
        'SELECT enunciado FROM contenido.pregunta WHERE contenido_id = $1',
        [contenidoId],
      );
      return rows.map((fila) => fila.enunciado);
    },

    async ejemplosAprobados(
      contenidoId: number,
      limite: number,
      tx: Ejecutor = bd,
    ): Promise<EjemploDePregunta[]> {
      if (limite <= 0) return [];
      const { rows } = await tx.query<{ id: string; enunciado: string }>(EJEMPLOS, [
        contenidoId,
        limite,
      ]);
      const ejemplos: EjemploDePregunta[] = [];
      for (const fila of rows) {
        const { rows: alternativas } = await tx.query<{
          letra: string;
          texto: string;
          esCorrecta: boolean;
        }>(
          `SELECT letra, texto, es_correcta AS "esCorrecta"
             FROM contenido.alternativa WHERE pregunta_id = $1 ORDER BY letra`,
          [fila.id],
        );
        ejemplos.push({ enunciado: fila.enunciado, alternativas });
      }
      return ejemplos;
    },
  };
}
