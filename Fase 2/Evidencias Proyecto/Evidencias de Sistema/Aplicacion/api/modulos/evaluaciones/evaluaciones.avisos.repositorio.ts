// El ítem sobre el que el estudiante avisa un error (HU-37, CU-13): debe ser de una evaluación suya.
// Entrega la pregunta y la versión que vio, que preguntas guarda en el aviso. Consulta parametrizada.
import type { Ejecutor } from '../../db/transaccion.js';

export interface ItemAvisable {
  preguntaId: string;
  version: number;
  anulada: boolean;
}

const ITEM = `
  SELECT i.pregunta_id::text AS "preguntaId", i.version_pregunta AS version, i.anulada
    FROM app.evaluacion_item i
    JOIN app.evaluacion e ON e.id = i.evaluacion_id
   WHERE e.id = $1 AND i.id = $2 AND e.estudiante_id = $3`;

export function crearAvisosItemRepositorio() {
  return {
    /** El ítem de esa evaluación del estudiante; null si no existe o es de otro estudiante. */
    async itemDelEstudiante(
      [evaluacionId, itemId, estudianteId]: [string, string, string],
      tx: Ejecutor,
    ): Promise<ItemAvisable | null> {
      const { rows } = await tx.query<ItemAvisable>(ITEM, [evaluacionId, itemId, estudianteId]);
      return rows[0] ?? null;
    },
  };
}

export type AvisosItemRepositorio = ReturnType<typeof crearAvisosItemRepositorio>;
