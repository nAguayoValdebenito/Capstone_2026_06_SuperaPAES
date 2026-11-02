// SQL de la bandeja del docente revisor (D01, HU-22, CU-19): sus revisiones pendientes, la pregunta tal
// como se envió a revisión (la versión guardada en contenido.pregunta_version) y el registro de su
// revisión con la pauta. Consultas siempre parametrizadas.
// Revisión a ciegas (HU-22 esc. 3): ninguna consulta de este archivo lee la dificultad sugerida de la
// pregunta ni la revisión de otro docente. Lee, sin escribirlas, la pregunta, su prueba, su temario y su
// texto de lectura, y por su código las listas criterio_pauta, dificultad, decision_revision,
// rol_revision y estado_asignacion.
import type { Ejecutor } from '../../db/transaccion.js';

/** Una revisión pendiente en la bandeja del docente. */
export interface FilaBandeja {
  id: string;
  preguntaId: string;
  ronda: number;
  prueba: { codigo: string; nombre: string };
  contenido: string;
  venceEn: Date;
}

/** La copia de la pregunta que guardó la base al enviarla a revisión (contenido.pregunta_version.copia). */
export interface CopiaPregunta {
  enunciado: string;
  explicacion: string;
  alternativas: { id: number; letra: string; texto: string; explicacion: string | null }[];
}

/** La revisión abierta por el docente: la versión que se revisa, con su ubicación en el temario. */
export interface FilaRevisionAbierta extends FilaBandeja {
  eje: string;
  habilidad: string;
  copia: CopiaPregunta;
  correctaId: string;
  texto: { titulo: string | null; contenido: string | null; imagenUrl: string | null } | null;
}

export interface Criterio {
  codigo: string;
  descripcion: string;
}

export interface OpcionRevision {
  codigo: string;
  nombre: string;
}

export interface Decision extends OpcionRevision {
  requiereComentario: boolean;
}

export interface RevisionNueva {
  asignacionId: string;
  decision: string;
  dificultad: string;
  comentario: string | null;
  criterios: readonly { codigo: string; cumple: boolean; observacion: string | null }[];
  entregadaEn: Date;
}

export interface BandejaRepositorio {
  /** Las revisiones pendientes del docente como revisor, la fecha límite más próxima primero. */
  listarPendientes(docenteId: string, tx?: Ejecutor): Promise<FilaBandeja[]>;
  /** La revisión pendiente del docente con la pregunta; null si no es suya o ya la entregó. */
  obtenerPendiente(
    id: string,
    docenteId: string,
    tx?: Ejecutor,
  ): Promise<FilaRevisionAbierta | null>;
  listarCriterios(tx?: Ejecutor): Promise<Criterio[]>;
  listarDificultades(tx?: Ejecutor): Promise<OpcionRevision[]>;
  listarDecisiones(tx?: Ejecutor): Promise<Decision[]>;
  /**
   * Reserva la asignación del docente (FOR UPDATE) hasta el fin de la transacción y devuelve su estado y
   * su pregunta; null si no es suya.
   */
  reservarAsignacion(
    id: string,
    docenteId: string,
    tx: Ejecutor,
  ): Promise<{ estado: string; preguntaId: string } | null>;
  /** Guarda la revisión con cada punto de la pauta y marca la asignación como completada. */
  guardarRevision(revision: RevisionNueva, tx: Ejecutor): Promise<void>;
}

/** Asignaciones como revisor (no como desempate, que es de D02), con su estado. */
const COMO_REVISOR = `
    FROM contenido.asignacion_revision a
    JOIN contenido.rol_revision r ON r.id = a.rol_revision_id AND r.codigo = 'revisor'
    JOIN contenido.estado_asignacion e ON e.id = a.estado_asignacion_id`;

/** Asignaciones del docente como revisor, con la versión que se revisa y su ubicación. */
const DEL_DOCENTE = `${COMO_REVISOR}
    JOIN contenido.pregunta_version v ON (v.pregunta_id, v.version) = (a.pregunta_id, a.version_revisada)
    JOIN contenido.pregunta p ON p.id = a.pregunta_id
    JOIN contenido.prueba pr ON pr.id = p.prueba_id
    JOIN contenido.contenido_tematico c ON c.id = v.contenido_id`;

const LISTAR_PENDIENTES = `
  SELECT a.id::text AS id, a.pregunta_id::text AS "preguntaId", a.ronda,
         json_build_object('codigo', pr.codigo, 'nombre', pr.nombre) AS prueba,
         c.nombre AS contenido, a.vence_en AS "venceEn"
  ${DEL_DOCENTE}
   WHERE a.docente_id = $1 AND e.codigo = 'pendiente'
   ORDER BY a.vence_en, a.id`;

const OBTENER_PENDIENTE = `
  SELECT a.id::text AS id, a.pregunta_id::text AS "preguntaId", a.ronda, a.vence_en AS "venceEn",
         json_build_object('codigo', pr.codigo, 'nombre', pr.nombre) AS prueba,
         ej.nombre AS eje, c.nombre AS contenido, h.nombre AS habilidad,
         v.copia, v.alternativa_correcta_id::text AS "correctaId",
         CASE WHEN t.id IS NULL THEN NULL
              ELSE json_build_object('titulo', t.titulo, 'contenido', t.contenido, 'imagenUrl', t.imagen_url)
         END AS texto
  ${DEL_DOCENTE}
    JOIN contenido.eje_tematico ej ON ej.id = v.eje_id
    JOIN contenido.habilidad h ON h.id = v.habilidad_id
    LEFT JOIN contenido.texto_estimulo t ON t.id = (v.copia ->> 'texto_estimulo_id')::bigint
   WHERE a.id = $1 AND a.docente_id = $2 AND e.codigo = 'pendiente'`;

const RESERVAR_ASIGNACION = `
  SELECT e.codigo AS estado, a.pregunta_id::text AS "preguntaId"
  ${COMO_REVISOR}
   WHERE a.id = $1 AND a.docente_id = $2
     FOR UPDATE OF a`;

const INSERTAR_REVISION = `
  INSERT INTO contenido.revision (asignacion_id, decision_revision_id, dificultad_id, comentario, creado_en)
  VALUES ($1, (SELECT id FROM contenido.decision_revision WHERE codigo = $2),
          (SELECT id FROM contenido.dificultad WHERE codigo = $3), $4, $5)
  RETURNING id::text AS id`;

const INSERTAR_CRITERIOS = `
  INSERT INTO contenido.revision_criterio (revision_id, criterio_id, cumple, observacion)
  SELECT $1, cp.id, x.cumple, x.observacion
    FROM unnest($2::text[], $3::boolean[], $4::text[]) AS x (codigo, cumple, observacion)
    JOIN contenido.criterio_pauta cp ON cp.codigo = x.codigo`;

const COMPLETAR_ASIGNACION = `
  UPDATE contenido.asignacion_revision
     SET estado_asignacion_id = (SELECT id FROM contenido.estado_asignacion WHERE codigo = 'completada'),
         completado_en = $2
   WHERE id = $1`;

/** Las listas de opciones de la pauta: criterios, dificultades y decisiones. */
function listas(
  bd: Ejecutor,
): Pick<BandejaRepositorio, 'listarCriterios' | 'listarDificultades' | 'listarDecisiones'> {
  return {
    async listarCriterios(tx = bd) {
      const { rows } = await tx.query<Criterio>(
        'SELECT codigo, descripcion FROM contenido.criterio_pauta WHERE activo ORDER BY orden',
      );
      return rows;
    },

    async listarDificultades(tx = bd) {
      const { rows } = await tx.query<OpcionRevision>(
        'SELECT codigo, nombre FROM contenido.dificultad ORDER BY orden',
      );
      return rows;
    },

    async listarDecisiones(tx = bd) {
      const { rows } = await tx.query<Decision>(
        `SELECT codigo, nombre, requiere_comentario AS "requiereComentario"
           FROM contenido.decision_revision ORDER BY id`,
      );
      return rows;
    },
  };
}

export function crearBandejaRepositorio(bd: Ejecutor): BandejaRepositorio {
  return {
    async listarPendientes(docenteId, tx = bd) {
      const { rows } = await tx.query<FilaBandeja>(LISTAR_PENDIENTES, [docenteId]);
      return rows;
    },

    async obtenerPendiente(id, docenteId, tx = bd) {
      const { rows } = await tx.query<FilaRevisionAbierta>(OBTENER_PENDIENTE, [id, docenteId]);
      return rows[0] ?? null;
    },

    ...listas(bd),

    async reservarAsignacion(id, docenteId, tx) {
      const { rows } = await tx.query<{ estado: string; preguntaId: string }>(RESERVAR_ASIGNACION, [
        id,
        docenteId,
      ]);
      return rows[0] ?? null;
    },

    async guardarRevision(revision, tx) {
      const { rows } = await tx.query<{ id: string }>(INSERTAR_REVISION, [
        revision.asignacionId,
        revision.decision,
        revision.dificultad,
        revision.comentario,
        revision.entregadaEn,
      ]);
      const revisionId = rows[0]?.id;
      if (revisionId === undefined) throw new Error('La revisión no se guardó.');
      await tx.query(INSERTAR_CRITERIOS, [
        revisionId,
        revision.criterios.map((criterio) => criterio.codigo),
        revision.criterios.map((criterio) => criterio.cumple),
        revision.criterios.map((criterio) => criterio.observacion),
      ]);
      await tx.query(COMPLETAR_ASIGNACION, [revision.asignacionId, revision.entregadaEn]);
    },
  };
}
