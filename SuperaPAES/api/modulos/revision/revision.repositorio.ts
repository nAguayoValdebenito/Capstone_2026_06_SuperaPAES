// Único lugar con SQL del módulo revision. Consultas siempre parametrizadas ($1, $2...).
// Tablas que pertenecen a este módulo (ningún otro módulo las escribe):
//   - contenido.asignacion_revision
//   - contenido.revision
//   - contenido.criterio_pauta
//   - contenido.revision_criterio
//   - vista contenido.v_calidad_criterio (calidad por criterio de la pauta; administracion la lee
//     por este servicio para el panel)
// Para elegir a los revisores (RN-10) lee, sin escribirlas, la pregunta, su contenido (el área), su lote
// de la IA (quién lo pidió) y los docentes con sus áreas. Lee por su código las listas rol, rol_revision
// y estado_asignacion.
// Cada método recibe un Ejecutor opcional (tx) para sumarse a la transacción del servicio.
import type { Ejecutor } from '../../db/transaccion.js';

/** Un docente que puede revisar la pregunta. */
export interface DocenteDisponible {
  id: string;
  nombre: string;
  correo: string;
}

/** Una revisión asignada a un docente (HU-21). */
export interface AsignacionNueva {
  id: string;
  docenteId: string;
  venceEn: Date;
}

export interface DatosAsignacion {
  preguntaId: string;
  ronda: number;
  version: number;
  docenteIds: readonly string[];
  asignadoEn: Date;
  venceEn: Date;
}

export interface RevisionRepositorio {
  /**
   * Reserva el área de la pregunta hasta el fin de la transacción: dos envíos del mismo área a la vez se
   * turnan, así el segundo cuenta las revisiones que asignó el primero y la carga se reparte.
   */
  reservarArea(preguntaId: string, tx: Ejecutor): Promise<void>;
  /**
   * RN-10 (CU-18a): los docentes activos con el área del contenido de la pregunta que no son su autor
   * ni quien pidió su lote a la IA, primero los que tienen menos revisiones pendientes.
   */
  docentesDisponibles(preguntaId: string, tx?: Ejecutor): Promise<DocenteDisponible[]>;
  /** El área del contenido de la pregunta, para el aviso cuando no hay docentes. */
  areaDeLaPregunta(preguntaId: string, tx?: Ejecutor): Promise<string | null>;
  /** Asigna la ronda de la pregunta a cada docente como revisor, pendiente hasta su fecha límite. */
  asignarRevisores(datos: DatosAsignacion, tx: Ejecutor): Promise<AsignacionNueva[]>;
}

const DOCENTES_DISPONIBLES = `
  SELECT u.id::text AS id, u.nombre, u.correo
    FROM contenido.pregunta p
    JOIN contenido.contenido_tematico c ON c.id = p.contenido_id
    JOIN contenido.docente_especialidad de ON de.area_id = c.area_id
    JOIN contenido.usuario_interno u ON u.id = de.usuario_interno_id AND u.activo
    JOIN contenido.rol r ON r.id = u.rol_id AND r.codigo = 'docente'
    LEFT JOIN contenido.lote_generacion l ON l.id = p.lote_id
   WHERE p.id = $1
     AND u.id IS DISTINCT FROM p.autor_id
     AND u.id IS DISTINCT FROM l.solicitante_id
   ORDER BY (SELECT count(*)
               FROM contenido.asignacion_revision a
               JOIN contenido.estado_asignacion e ON e.id = a.estado_asignacion_id
              WHERE a.docente_id = u.id AND NOT e.es_final),
            u.id`;

/** Primer número del candado de pg_advisory_xact_lock: «elegir revisores» (HU-21); el segundo es el área. */
const CANDADO_REVISORES = 2101;

const RESERVAR_AREA = `
  SELECT pg_advisory_xact_lock($2, c.area_id)
    FROM contenido.pregunta p
    JOIN contenido.contenido_tematico c ON c.id = p.contenido_id
   WHERE p.id = $1`;

const AREA_DE_LA_PREGUNTA = `
  SELECT ar.nombre
    FROM contenido.pregunta p
    JOIN contenido.contenido_tematico c ON c.id = p.contenido_id
    JOIN contenido.area ar ON ar.id = c.area_id
   WHERE p.id = $1`;

const ASIGNAR_REVISORES = `
  INSERT INTO contenido.asignacion_revision (pregunta_id, ronda, version_revisada, docente_id,
                                            rol_revision_id, estado_asignacion_id, asignado_en, vence_en)
  SELECT $1, $2, $3, d.docente_id,
         (SELECT id FROM contenido.rol_revision WHERE codigo = 'revisor'),
         (SELECT id FROM contenido.estado_asignacion WHERE codigo = 'pendiente'), $5, $6
    FROM unnest($4::bigint[]) AS d (docente_id)
  RETURNING id::text AS id, docente_id::text AS "docenteId", vence_en AS "venceEn"`;

export function crearRevisionRepositorio(bd: Ejecutor): RevisionRepositorio {
  return {
    async reservarArea(preguntaId, tx) {
      await tx.query(RESERVAR_AREA, [preguntaId, CANDADO_REVISORES]);
    },

    async docentesDisponibles(preguntaId, tx = bd) {
      const { rows } = await tx.query<DocenteDisponible>(DOCENTES_DISPONIBLES, [preguntaId]);
      return rows;
    },

    async areaDeLaPregunta(preguntaId, tx = bd) {
      const { rows } = await tx.query<{ nombre: string }>(AREA_DE_LA_PREGUNTA, [preguntaId]);
      return rows[0]?.nombre ?? null;
    },

    async asignarRevisores(datos, tx) {
      const { rows } = await tx.query<AsignacionNueva>(ASIGNAR_REVISORES, [
        datos.preguntaId,
        datos.ronda,
        datos.version,
        datos.docenteIds,
        datos.asignadoEn,
        datos.venceEn,
      ]);
      return rows;
    },
  };
}
