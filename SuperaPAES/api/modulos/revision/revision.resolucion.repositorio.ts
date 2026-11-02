// SQL para resolver la ronda de revisión de una pregunta (HU-23, CU-19 paso 7, RN-11): las asignaciones
// de su ronda vigente con lo que entregó cada docente. Consultas siempre parametrizadas.
// Lee, sin escribirla, la pregunta (su ronda vigente) y por su código las listas rol_revision,
// estado_asignacion, decision_revision y dificultad. El cambio de etapa lo hace el módulo preguntas.
import type { RolAsignacion } from '../../comun/roles.js';
import type { Ejecutor } from '../../db/transaccion.js';

/** Una asignación de la ronda vigente; sin revisión entregada, decisión y dificultad son null. */
export interface AsignacionDeLaRonda {
  docenteId: string;
  rol: RolAsignacion;
  estado: string;
  ronda: number;
  version: number;
  decision: string | null;
  dificultad: string | null;
}

export interface ResolucionRepositorio {
  /**
   * Reserva la pregunta hasta el fin de la transacción: si los dos revisores entregan a la vez, el
   * segundo espera al primero y ve su revisión, así la ronda se resuelve una vez.
   */
  reservarPregunta(preguntaId: string, tx: Ejecutor): Promise<void>;
  /** Las asignaciones de la ronda vigente de la pregunta, con su revisión si la hay. */
  asignacionesDeLaRonda(preguntaId: string, tx: Ejecutor): Promise<AsignacionDeLaRonda[]>;
}

/** Primer número del candado de pg_advisory_xact_lock: «resolver la ronda» (HU-23); el segundo es la pregunta. */
const CANDADO_RONDA = 2301;

const ASIGNACIONES_DE_LA_RONDA = `
  SELECT a.docente_id::text AS "docenteId", r.codigo AS rol, e.codigo AS estado, a.ronda,
         a.version_revisada AS version, dr.codigo AS decision, d.codigo AS dificultad
    FROM contenido.pregunta p
    JOIN contenido.asignacion_revision a ON a.pregunta_id = p.id AND a.ronda = p.ronda_actual
    JOIN contenido.rol_revision r ON r.id = a.rol_revision_id
    JOIN contenido.estado_asignacion e ON e.id = a.estado_asignacion_id
    LEFT JOIN contenido.revision rv ON rv.asignacion_id = a.id
    LEFT JOIN contenido.decision_revision dr ON dr.id = rv.decision_revision_id
    LEFT JOIN contenido.dificultad d ON d.id = rv.dificultad_id
   WHERE p.id = $1
   ORDER BY a.id`;

export function crearResolucionRepositorio(): ResolucionRepositorio {
  return {
    async reservarPregunta(preguntaId, tx) {
      // El candado de dos números es de 32 bits: dos preguntas con el mismo resto solo se turnan.
      await tx.query('SELECT pg_advisory_xact_lock($1, ($2::bigint % 2147483647)::int)', [
        CANDADO_RONDA,
        preguntaId,
      ]);
    },

    async asignacionesDeLaRonda(preguntaId, tx) {
      const { rows } = await tx.query<AsignacionDeLaRonda>(ASIGNACIONES_DE_LA_RONDA, [preguntaId]);
      return rows;
    },
  };
}
