// SQL del seguimiento de las revisiones (C06, HU-21 y HU-23). Solo lee: cada pregunta que entró a revisión
// cae en un grupo, y de la ronda actual se muestran sus docentes con lo que decidieron. Una revisión pendiente
// fuera de plazo se ve como vencida, aunque nadie la haya marcado: la reasignación llega con HU-28.
import type { Ejecutor } from '../../db/transaccion.js';
import type { GrupoSeguimiento } from './revision.reglas.js';

export interface FilaSeguimiento {
  id: string;
  prueba: string;
  contenido: string;
  estado: string;
  estadoNombre: string;
  posibleConfusa: boolean;
}

export interface AsignacionSeguida {
  preguntaId: string;
  rol: 'revisor' | 'desempate';
  correo: string;
  estado: string;
  venceEn: Date;
  decision: string | null;
  dificultad: string | null;
}

export interface AreaSinDocentes {
  area: string;
  preguntas: number;
}

/** Cada pregunta que pasó por revisión, con su grupo. $1 es la hora actual. */
const PREGUNTAS_CON_GRUPO = `
  WITH seguimiento AS (
    SELECT p.id, p.creado_en, pr.codigo AS prueba, c.nombre AS contenido, e.codigo AS estado,
           e.nombre AS "estadoNombre", p.posible_ambigua AS "posibleConfusa",
           CASE
             WHEN e.codigo NOT IN ('en_revision', 'en_desempate') THEN 'terminadas'
             WHEN EXISTS (
               SELECT 1
                 FROM contenido.asignacion_revision a
                 JOIN contenido.estado_asignacion ea ON ea.id = a.estado_asignacion_id
                WHERE a.pregunta_id = p.id AND a.ronda = p.ronda_actual
                  AND (ea.codigo = 'vencida' OR (ea.codigo = 'pendiente' AND a.vence_en < $1))
             ) THEN 'vencidas'
             WHEN e.codigo = 'en_desempate' THEN 'en_desempate'
             ELSE 'en_curso'
           END AS grupo
      FROM contenido.pregunta p
      JOIN contenido.estado_pregunta e ON e.id = p.estado_pregunta_id
      JOIN contenido.prueba pr ON pr.id = p.prueba_id
      JOIN contenido.contenido_tematico c ON c.id = p.contenido_id
     WHERE EXISTS (SELECT 1 FROM contenido.asignacion_revision a WHERE a.pregunta_id = p.id)
  )`;

const ASIGNACIONES = `
  SELECT a.pregunta_id::text AS "preguntaId", rr.codigo AS rol, u.correo, ea.codigo AS estado,
         a.vence_en AS "venceEn", dr.codigo AS decision, d.nombre AS dificultad
    FROM contenido.asignacion_revision a
    JOIN contenido.pregunta p ON p.id = a.pregunta_id AND p.ronda_actual = a.ronda
    JOIN contenido.rol_revision rr ON rr.id = a.rol_revision_id
    JOIN contenido.usuario_interno u ON u.id = a.docente_id
    JOIN contenido.estado_asignacion ea ON ea.id = a.estado_asignacion_id
    LEFT JOIN contenido.revision r ON r.asignacion_id = a.id
    LEFT JOIN contenido.decision_revision dr ON dr.id = r.decision_revision_id
    LEFT JOIN contenido.dificultad d ON d.id = r.dificultad_id
   WHERE a.pregunta_id = ANY ($1::bigint[])
   ORDER BY a.id`;

/** Áreas con borradores que no alcanzan los revisores requeridos (CU-18a). $1 son los requeridos. */
const AREAS_SIN_DOCENTES = `
  SELECT ar.nombre AS area, count(*)::int AS preguntas
    FROM contenido.pregunta p
    JOIN contenido.estado_pregunta e ON e.id = p.estado_pregunta_id AND e.codigo = 'borrador'
    JOIN contenido.contenido_tematico c ON c.id = p.contenido_id
    JOIN contenido.area ar ON ar.id = c.area_id
   WHERE (SELECT count(*)
            FROM contenido.docente_especialidad de
            JOIN contenido.usuario_interno u ON u.id = de.usuario_interno_id AND u.activo
            JOIN contenido.rol r ON r.id = u.rol_id AND r.codigo = 'docente'
           WHERE de.area_id = c.area_id) < $1
   GROUP BY ar.nombre
   ORDER BY ar.nombre`;

export function crearSeguimientoRepositorio(bd: Ejecutor) {
  return {
    /** Una página del grupo: primero lo más antiguo, que lleva más tiempo esperando. */
    async listar(
      [ahora, grupo]: [Date, GrupoSeguimiento],
      limite: number,
      desde: number,
    ): Promise<FilaSeguimiento[]> {
      const { rows } = await bd.query<FilaSeguimiento>(
        `${PREGUNTAS_CON_GRUPO}
         SELECT id::text AS id, prueba, contenido, estado, "estadoNombre", "posibleConfusa"
           FROM seguimiento WHERE grupo = $2
          ORDER BY creado_en, id LIMIT $3 OFFSET $4`,
        [ahora, grupo, limite, desde],
      );
      return rows;
    },

    async contarPorGrupo(ahora: Date): Promise<Partial<Record<GrupoSeguimiento, number>>> {
      const { rows } = await bd.query<{ grupo: GrupoSeguimiento; total: number }>(
        `${PREGUNTAS_CON_GRUPO}
         SELECT grupo, count(*)::int AS total FROM seguimiento GROUP BY grupo`,
        [ahora],
      );
      return Object.fromEntries(rows.map(({ grupo, total }) => [grupo, total]));
    },

    async asignaciones(preguntaIds: readonly string[]): Promise<AsignacionSeguida[]> {
      if (preguntaIds.length === 0) return [];
      const { rows } = await bd.query<AsignacionSeguida>(ASIGNACIONES, [preguntaIds]);
      return rows;
    },

    async areasSinDocentes(requeridos: number): Promise<AreaSinDocentes[]> {
      const { rows } = await bd.query<AreaSinDocentes>(AREAS_SIN_DOCENTES, [requeridos]);
      return rows;
    },
  };
}

export type SeguimientoRepositorio = ReturnType<typeof crearSeguimientoRepositorio>;
