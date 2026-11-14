// Bandeja de calibración del docente (HU-26.1, RF-G13, RN-15): contenido.calibracion_pregunta, de este
// módulo (migración 008). Las estadísticas y qué preguntas salieron de su rango las entrega el servicio de
// evaluaciones; aquí se filtran por el área del docente y por lo que ya decidió.
import type { Ejecutor } from '../../db/transaccion.js';

/** Lo que la bandeja muestra de la pregunta, más las decisiones de los docentes del área. */
export interface PreguntaDeCalibracion {
  preguntaId: string;
  enunciado: string;
  prueba: string;
  contenido: string;
  /** Docentes que confirmaron que la dificultad no corresponde, para esta versión y dificultad. */
  confirmaciones: number;
  /** Docentes que la descartaron (la dificultad sí corresponde). */
  descartes: number;
}

/** La decisión que se guarda, con la versión, la dificultad y los intentos del momento. */
export interface DecisionCalibracion {
  preguntaId: string;
  version: number;
  dificultadId: number;
  docenteId: string;
  dificultadCorresponde: boolean;
  intentos: number;
  aciertos: number;
  creadoEn: Date;
}

/** Una de las preguntas que salieron de su rango, con su versión y dificultad actuales. */
export interface CandidataCalibracion {
  preguntaId: string;
  version: number;
  dificultadId: number;
}

/** Una pregunta publicada con al menos una confirmación para su versión y dificultad actuales (C02). */
export interface ConfirmadaDeCalibracion extends PreguntaDeCalibracion {
  dificultad: {
    codigo: string;
    nombre: string;
    aciertoEsperadoMin: number;
    aciertoEsperadoMax: number;
  };
  /** Fecha de la primera confirmación pendiente. */
  confirmadaEn: Date;
}

export interface CalibracionRepositorio {
  /** HU-26.2: las publicadas confirmadas por algún docente, en el orden en que se confirmaron. */
  confirmadas(tx?: Ejecutor): Promise<ConfirmadaDeCalibracion[]>;
  /** De esas candidatas, las del área del docente que él todavía no decidió. */
  pendientesDelDocente(
    docenteId: string,
    candidatas: CandidataCalibracion[],
    tx?: Ejecutor,
  ): Promise<PreguntaDeCalibracion[]>;
  /** ¿Ese docente ya decidió esa versión y dificultad de la pregunta? */
  yaDecidio(docenteId: string, candidata: CandidataCalibracion, tx: Ejecutor): Promise<boolean>;
  /** Guarda la decisión; devuelve false si ese docente ya decidió esa versión y dificultad. */
  guardarDecision(datos: DecisionCalibracion, tx: Ejecutor): Promise<boolean>;
}

// El área sale del contenido de la pregunta (como al asignar revisores, RN-10) y el docente debe estar
// activo con el rol docente.
const SQL_PENDIENTES = `
  WITH candidata AS (
    SELECT * FROM unnest($2::bigint[], $3::int[], $4::smallint[]) AS c(pregunta_id, version, dificultad_id)
  )
  SELECT p.id::text AS "preguntaId", left(p.enunciado, 200) AS enunciado, pr.nombre AS prueba,
         ct.nombre AS contenido,
         COUNT(cp.id) FILTER (WHERE NOT cp.dificultad_corresponde)::int AS confirmaciones,
         COUNT(cp.id) FILTER (WHERE cp.dificultad_corresponde)::int AS descartes
    FROM candidata c
    JOIN contenido.pregunta p ON p.id = c.pregunta_id
    JOIN contenido.prueba pr ON pr.id = p.prueba_id
    JOIN contenido.contenido_tematico ct ON ct.id = p.contenido_id
    JOIN contenido.docente_especialidad de ON de.area_id = ct.area_id AND de.usuario_interno_id = $1
    JOIN contenido.usuario_interno u ON u.id = de.usuario_interno_id AND u.activo
    JOIN contenido.rol r ON r.id = u.rol_id AND r.codigo = 'docente'
    LEFT JOIN contenido.calibracion_pregunta cp
      ON (cp.pregunta_id, cp.version_pregunta, cp.dificultad_id) = (c.pregunta_id, c.version, c.dificultad_id)
   GROUP BY p.id, pr.nombre, ct.nombre
  HAVING NOT COALESCE(bool_or(cp.docente_id = $1::bigint), false)
   ORDER BY p.id`;

// Pendiente mientras la pregunta siga publicada con la misma versión y dificultad: al retirarla deja de
// estarlo sola (plan, sección 5).
const SQL_CONFIRMADAS = `
  SELECT p.id::text AS "preguntaId", left(p.enunciado, 200) AS enunciado, pr.nombre AS prueba,
         ct.nombre AS contenido,
         json_build_object('codigo', d.codigo, 'nombre', d.nombre, 'aciertoEsperadoMin', d.acierto_esperado_min,
                           'aciertoEsperadoMax', d.acierto_esperado_max) AS dificultad,
         COUNT(*) FILTER (WHERE NOT cp.dificultad_corresponde)::int AS confirmaciones,
         COUNT(*) FILTER (WHERE cp.dificultad_corresponde)::int AS descartes,
         MIN(cp.creado_en) FILTER (WHERE NOT cp.dificultad_corresponde) AS "confirmadaEn"
    FROM contenido.calibracion_pregunta cp
    JOIN contenido.pregunta p
      ON p.id = cp.pregunta_id AND p.version = cp.version_pregunta AND p.dificultad_asignada_id = cp.dificultad_id
    JOIN contenido.estado_pregunta ep ON ep.id = p.estado_pregunta_id AND ep.codigo = 'publicada'
    JOIN contenido.prueba pr ON pr.id = p.prueba_id
    JOIN contenido.contenido_tematico ct ON ct.id = p.contenido_id
    JOIN contenido.dificultad d ON d.id = p.dificultad_asignada_id
   GROUP BY p.id, pr.nombre, ct.nombre, d.id
  HAVING COUNT(*) FILTER (WHERE NOT cp.dificultad_corresponde) > 0
   ORDER BY "confirmadaEn", p.id`;

export function crearCalibracionRepositorio(bd: Ejecutor): CalibracionRepositorio {
  return {
    async confirmadas(tx = bd) {
      const { rows } = await tx.query<ConfirmadaDeCalibracion>(SQL_CONFIRMADAS);
      return rows;
    },
    async pendientesDelDocente(docenteId, candidatas, tx = bd) {
      if (candidatas.length === 0) return [];
      const { rows } = await tx.query<PreguntaDeCalibracion>(SQL_PENDIENTES, [
        docenteId,
        candidatas.map((c) => c.preguntaId),
        candidatas.map((c) => c.version),
        candidatas.map((c) => c.dificultadId),
      ]);
      return rows;
    },
    async yaDecidio(docenteId, { preguntaId, version, dificultadId }, tx) {
      const { rows } = await tx.query(
        `SELECT 1 FROM contenido.calibracion_pregunta
          WHERE pregunta_id = $1 AND version_pregunta = $2 AND dificultad_id = $3 AND docente_id = $4`,
        [preguntaId, version, dificultadId, docenteId],
      );
      return rows.length > 0;
    },
    async guardarDecision(datos, tx) {
      const resultado = await tx.query(
        `INSERT INTO contenido.calibracion_pregunta (pregunta_id, version_pregunta, dificultad_id, docente_id,
           dificultad_corresponde, intentos, aciertos, creado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (pregunta_id, version_pregunta, dificultad_id, docente_id) DO NOTHING`,
        [
          datos.preguntaId,
          datos.version,
          datos.dificultadId,
          datos.docenteId,
          datos.dificultadCorresponde,
          datos.intentos,
          datos.aciertos,
          datos.creadoEn,
        ],
      );
      return (resultado.rowCount ?? 0) === 1;
    },
  };
}
