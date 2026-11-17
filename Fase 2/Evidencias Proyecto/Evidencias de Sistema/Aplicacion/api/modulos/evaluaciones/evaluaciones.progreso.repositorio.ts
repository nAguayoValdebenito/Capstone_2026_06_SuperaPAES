// HU-38.1 (RF-A10, RN-14): consultas del progreso del estudiante sobre las respuestas que cuentan
// (app.v_respuesta_valida: prácticas, repasos y evaluaciones, sin anuladas). Lee las vistas del módulo
// sin cambiarlas: el eje a reforzar sale de app.v_progreso_eje, la misma que usa la selección de
// preguntas, para que la app y la práctica marquen los mismos ejes.
import type { Ejecutor } from '../../db/transaccion.js';

/** Porcentaje de acierto por código de dificultad (facil, media, dificil); solo las que tienen respuestas. */
export type AciertoPorDificultad = Record<string, number>;

export interface FilaPruebaProgreso {
  pruebaId: number;
  codigo: string;
  nombre: string;
  respondidas: number;
  correctas: number;
  acierto: number;
  aciertoPonderado: number;
  aciertoPorDificultad: AciertoPorDificultad;
}

/** Un eje o una habilidad de una prueba, con su acierto ponderado. */
export interface FilaGrupoProgreso {
  pruebaId: number;
  id: number;
  nombre: string;
  respondidas: number;
  correctas: number;
  aciertoPonderado: number;
  aciertoPorDificultad: AciertoPorDificultad;
  aReforzar: boolean;
}

export interface FilaSemanaProgreso {
  pruebaId: number;
  /** Lunes de la semana, en hora de Chile (AAAA-MM-DD). */
  semana: string;
  respondidas: number;
  acierto: number;
}

export interface FilaEnsayoProgreso {
  pruebaId: number;
  id: string;
  cerradaEn: Date;
  puntaje: number;
}

/** Respuestas del estudiante con su dificultad y su peso en el acierto ponderado. */
const RESPUESTAS = `
  SELECT r.prueba_id, r.eje_id, r.habilidad_id, r.es_correcta, d.codigo, d.peso
    FROM app.v_respuesta_valida r JOIN contenido.dificultad d ON d.id = r.dificultad_id
   WHERE r.estudiante_id = $1`;

/** Acierto ponderado: las difíciles pesan más (contenido.dificultad.peso), como en v_progreso_eje. */
const PONDERADO = 'ROUND(100.0 * SUM(pd.c * pd.peso) / SUM(pd.n * pd.peso), 1)::float8';
const POR_DIFICULTAD = 'jsonb_object_agg(pd.codigo, ROUND(100.0 * pd.c / pd.n, 1))';

const PRUEBAS = `
  WITH pd AS (
    SELECT prueba_id, codigo, MAX(peso) AS peso, COUNT(*) AS n, COUNT(*) FILTER (WHERE es_correcta) AS c
      FROM (${RESPUESTAS}) r GROUP BY prueba_id, codigo)
  SELECT p.id AS "pruebaId", p.codigo, p.nombre, SUM(n)::int AS respondidas, SUM(c)::int AS correctas,
         ROUND(100.0 * SUM(c) / SUM(n), 1)::float8 AS acierto, ${PONDERADO} AS "aciertoPonderado",
         ${POR_DIFICULTAD} AS "aciertoPorDificultad"
    FROM pd JOIN contenido.prueba p ON p.id = pd.prueba_id
   GROUP BY p.id
   ORDER BY p.id`;

/** En Competencia Lectora los ejes no se marcan: se refuerza por habilidad (RN-14). */
const EJES = `
  SELECT pe.prueba_id AS "pruebaId", pe.eje_id AS id, e.nombre, pe.respondidas::int AS respondidas,
         pe.correctas::int AS correctas, pe.acierto_ponderado::float8 AS "aciertoPonderado",
         pe.acierto_por_dificultad AS "aciertoPorDificultad",
         (pe.a_reforzar AND p.codigo <> 'CL') AS "aReforzar"
    FROM app.v_progreso_eje pe
    JOIN contenido.eje_tematico e ON e.id = pe.eje_id
    JOIN contenido.prueba p ON p.id = pe.prueba_id
   WHERE pe.estudiante_id = $1
   ORDER BY pe.prueba_id, e.orden, e.id`;

/**
 * La habilidad se refuerza con la misma regla que el eje ($2 respuestas como mínimo y acierto
 * ponderado bajo $3), solo en Competencia Lectora, que no depende del curso.
 */
const HABILIDADES = `
  WITH pd AS (
    SELECT prueba_id, habilidad_id, codigo, MAX(peso) AS peso, COUNT(*) AS n,
           COUNT(*) FILTER (WHERE es_correcta) AS c
      FROM (${RESPUESTAS}) r WHERE habilidad_id IS NOT NULL GROUP BY prueba_id, habilidad_id, codigo)
  SELECT pd.prueba_id AS "pruebaId", h.id, h.nombre, SUM(n)::int AS respondidas, SUM(c)::int AS correctas,
         ${PONDERADO} AS "aciertoPonderado", ${POR_DIFICULTAD} AS "aciertoPorDificultad",
         (p.codigo = 'CL' AND SUM(n) >= $2 AND ${PONDERADO} < $3) AS "aReforzar"
    FROM pd
    JOIN contenido.habilidad h ON h.id = pd.habilidad_id
    JOIN contenido.prueba p ON p.id = pd.prueba_id
   GROUP BY pd.prueba_id, p.codigo, h.id
   ORDER BY pd.prueba_id, h.codigo, h.id`;

/** La semana empieza el lunes en hora de Chile (no en la del servidor, como v_evolucion_semanal). */
const SEMANAS = `
  SELECT prueba_id AS "pruebaId",
         to_char(date_trunc('week', fecha AT TIME ZONE 'America/Santiago'), 'YYYY-MM-DD') AS semana,
         COUNT(*)::int AS respondidas,
         ROUND(100.0 * COUNT(*) FILTER (WHERE es_correcta) / COUNT(*), 1)::float8 AS acierto
    FROM app.v_respuesta_valida
   WHERE estudiante_id = $1
   GROUP BY 1, 2
   ORDER BY 1, 2`;

/** Ensayos completos con su puntaje estimado (RN-23): solo el tipo que entrega puntaje lo tiene. */
const ENSAYOS = `
  SELECT e.prueba_id AS "pruebaId", e.id::text AS id, e.cerrada_en AS "cerradaEn", r.puntaje
    FROM app.evaluacion e
    JOIN contenido.tipo_evaluacion t ON t.id = e.tipo_evaluacion_id
    JOIN app.resultado_evaluacion r ON r.evaluacion_id = e.id
   WHERE e.estudiante_id = $1 AND t.entrega_puntaje AND r.puntaje IS NOT NULL
   ORDER BY e.cerrada_en, e.id`;

export interface ReglaReforzar {
  minRespuestas: number;
  umbral: number;
}

export function crearProgresoRepositorio(bd: Ejecutor) {
  return {
    async leerPruebas(estudianteId: string, tx: Ejecutor = bd) {
      const { rows } = await tx.query<FilaPruebaProgreso>(PRUEBAS, [estudianteId]);
      return rows;
    },
    async leerEjes(estudianteId: string, tx: Ejecutor = bd) {
      const { rows } = await tx.query<FilaGrupoProgreso>(EJES, [estudianteId]);
      return rows;
    },
    async leerHabilidades(estudianteId: string, regla: ReglaReforzar, tx: Ejecutor = bd) {
      const { rows } = await tx.query<FilaGrupoProgreso>(HABILIDADES, [
        estudianteId,
        regla.minRespuestas,
        regla.umbral,
      ]);
      return rows;
    },
    async leerSemanas(estudianteId: string, tx: Ejecutor = bd) {
      const { rows } = await tx.query<FilaSemanaProgreso>(SEMANAS, [estudianteId]);
      return rows;
    },
    async leerEnsayos(estudianteId: string, tx: Ejecutor = bd) {
      const { rows } = await tx.query<FilaEnsayoProgreso>(ENSAYOS, [estudianteId]);
      return rows;
    },
  };
}

export type ProgresoRepositorio = ReturnType<typeof crearProgresoRepositorio>;
