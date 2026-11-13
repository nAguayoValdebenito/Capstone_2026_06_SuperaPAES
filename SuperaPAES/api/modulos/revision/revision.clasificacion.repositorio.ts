// SQL de la clasificación de dificultad del banco semilla (D03, HU-25, CU-19a, RF-G12). Consultas siempre
// parametrizadas. La bandeja son las asignaciones pendientes del docente como revisor cuya pregunta es
// importada (contenido.pregunta.importacion_id): las asignó el envío a revisión (CU-18 7.a, RN-10), así
// que dos docentes nunca reciben una pregunta que no les toca. A ciegas (RN-12): ninguna consulta lee la
// dificultad sugerida ni la revisión del otro docente. La revisión se guarda con el repositorio de la
// bandeja (revision.bandeja.repositorio.ts), igual que en D01.
import type { Ejecutor } from '../../db/transaccion.js';
import {
  ASIGNACIONES,
  type FilaRevisionAbierta,
  PREGUNTA_ABIERTA,
} from './revision.bandeja.repositorio.js';

export interface ClasificacionRepositorio {
  /**
   * La siguiente asignación por clasificar del docente, la fecha límite más próxima primero. Con
   * `despuesDe` (una asignación del docente) sigue después de ella y, al llegar al final, vuelve a la
   * primera; null si no queda ninguna.
   */
  siguiente(
    docenteId: string,
    despuesDe: string | null,
    tx?: Ejecutor,
  ): Promise<FilaRevisionAbierta | null>;
  /** Cuántas asignaciones quedan por clasificar. */
  contarPendientes(docenteId: string, tx?: Ejecutor): Promise<number>;
  /**
   * Reserva la asignación del docente como revisor de una pregunta importada (FOR UPDATE) hasta el fin de
   * la transacción y devuelve su estado y su pregunta; null si no es suya o la pregunta no es importada.
   */
  reservarAsignacion(
    id: string,
    docenteId: string,
    tx: Ejecutor,
  ): Promise<{ estado: string; preguntaId: string } | null>;
}

/** Revisor de una pregunta importada; la consulta agrega el estado y el docente. */
const DE_IMPORTADA = `r.codigo = 'revisor' AND p.importacion_id IS NOT NULL`;

// Al saltar, las que están antes de `despuesDe` (o es ella) van al final: (fecha, id) <= los de ella.
// Sin `despuesDe` la comparación es nula para todas y manda el orden por fecha.
const SIGUIENTE = `${PREGUNTA_ABIERTA}
    LEFT JOIN contenido.asignacion_revision ref ON ref.id = $2::bigint AND ref.docente_id = $1
   WHERE a.docente_id = $1 AND e.codigo = 'pendiente' AND ${DE_IMPORTADA}
   ORDER BY (a.vence_en, a.id) <= (ref.vence_en, ref.id), a.vence_en, a.id
   LIMIT 1`;

const CONTAR_PENDIENTES = `
  SELECT count(*)::int AS total
  ${ASIGNACIONES}
    JOIN contenido.pregunta p ON p.id = a.pregunta_id
   WHERE a.docente_id = $1 AND e.codigo = 'pendiente' AND ${DE_IMPORTADA}`;

const RESERVAR_ASIGNACION = `
  SELECT e.codigo AS estado, a.pregunta_id::text AS "preguntaId"
  ${ASIGNACIONES}
    JOIN contenido.pregunta p ON p.id = a.pregunta_id
   WHERE a.id = $1 AND a.docente_id = $2 AND ${DE_IMPORTADA}
     FOR UPDATE OF a`;

export function crearClasificacionRepositorio(bd: Ejecutor): ClasificacionRepositorio {
  return {
    async siguiente(docenteId, despuesDe, tx = bd) {
      const { rows } = await tx.query<FilaRevisionAbierta>(SIGUIENTE, [docenteId, despuesDe]);
      return rows[0] ?? null;
    },

    async contarPendientes(docenteId, tx = bd) {
      const { rows } = await tx.query<{ total: number }>(CONTAR_PENDIENTES, [docenteId]);
      return rows[0]?.total ?? 0;
    },

    async reservarAsignacion(id, docenteId, tx) {
      const { rows } = await tx.query<{ estado: string; preguntaId: string }>(RESERVAR_ASIGNACION, [
        id,
        docenteId,
      ]);
      return rows[0] ?? null;
    },
  };
}
