// Estadísticas por pregunta en app.estadistica_pregunta (HU-53.1, RF-G13, RN-15; plan
// hu-26-calibracion.md, 3.2). Cuentan las respuestas de app.v_respuesta_valida (el criterio del progreso:
// tipos que cuentan, corregidas y no anuladas) que el estudiante respondió (no las omitidas) sobre la
// versión actual de la pregunta. Se recalcula todo de una vez: volver a ejecutarlo da lo mismo.
import type { Ejecutor } from '../../db/transaccion.js';

/** Intentos, aciertos y tiempo promedio de una pregunta, con el acierto en porcentaje (un decimal). */
export interface EstadisticaPregunta {
  preguntaId: string;
  intentos: number;
  aciertos: number;
  /** `null` si no tiene intentos (por ejemplo, porque se anuló). */
  porcentajeAcierto: number | null;
  tiempoPromedioSeg: number | null;
  actualizadoEn: Date;
}

/** Una pregunta publicada cuyo acierto quedó fuera del rango esperado de su dificultad (RN-15). */
export interface EstadisticaFueraDeRango extends Omit<EstadisticaPregunta, 'actualizadoEn'> {
  porcentajeAcierto: number;
  version: number;
  dificultad: {
    id: number;
    codigo: string;
    nombre: string;
    aciertoEsperadoMin: number;
    aciertoEsperadoMax: number;
  };
}

interface FilaFueraDeRango extends Omit<EstadisticaFueraDeRango, 'dificultad'> {
  dificultadId: number;
  dificultadCodigo: string;
  dificultadNombre: string;
  aciertoEsperadoMin: number;
  aciertoEsperadoMax: number;
}

// Solo las publicadas (las que reciben respuestas). Los extremos del rango cuentan dentro.
const SQL_FUERA_DE_RANGO = `
  SELECT s.pregunta_id::text AS "preguntaId", v.version, s.intentos, s.aciertos,
         ROUND(100.0 * s.aciertos / s.intentos, 1)::float8 AS "porcentajeAcierto",
         s.tiempo_promedio_seg AS "tiempoPromedioSeg", d.id AS "dificultadId", d.codigo AS "dificultadCodigo",
         d.nombre AS "dificultadNombre", d.acierto_esperado_min AS "aciertoEsperadoMin",
         d.acierto_esperado_max AS "aciertoEsperadoMax"
    FROM app.estadistica_pregunta s
    JOIN contenido.v_preguntas_publicadas v ON v.id = s.pregunta_id
    JOIN contenido.dificultad d ON d.codigo = v.dificultad
   WHERE s.intentos >= $1
     AND (100.0 * s.aciertos / s.intentos < d.acierto_esperado_min
          OR 100.0 * s.aciertos / s.intentos > d.acierto_esperado_max)
   ORDER BY s.pregunta_id`;

const conDificultad = ({
  dificultadId,
  dificultadCodigo,
  dificultadNombre,
  aciertoEsperadoMin,
  aciertoEsperadoMax,
  ...estadistica
}: FilaFueraDeRango): EstadisticaFueraDeRango => ({
  ...estadistica,
  dificultad: {
    id: dificultadId,
    codigo: dificultadCodigo,
    nombre: dificultadNombre,
    aciertoEsperadoMin,
    aciertoEsperadoMax,
  },
});

// Las preguntas que ya tenían fila y se quedaron sin respuestas válidas vuelven a cero. Solo se escriben
// las filas que cambian, así que la cuenta devuelta dice cuántas cambiaron.
const SQL_RECALCULAR = `
  WITH validas AS (
    SELECT r.pregunta_id, COUNT(*)::int AS intentos, COUNT(*) FILTER (WHERE r.es_correcta)::int AS aciertos,
           ROUND(AVG(i.tiempo_seg))::int AS tiempo
      FROM app.v_respuesta_valida r
      JOIN app.evaluacion_item i ON i.id = r.evaluacion_item_id
      JOIN contenido.pregunta p ON p.id = r.pregunta_id AND p.version = i.version_pregunta
     WHERE i.alternativa_id IS NOT NULL
     GROUP BY r.pregunta_id
  ), nuevas AS (
    SELECT pregunta_id, intentos, aciertos, tiempo FROM validas
    UNION ALL
    SELECT e.pregunta_id, 0, 0, NULL::int FROM app.estadistica_pregunta e
     WHERE NOT EXISTS (SELECT 1 FROM validas v WHERE v.pregunta_id = e.pregunta_id)
  )
  INSERT INTO app.estadistica_pregunta AS s (pregunta_id, intentos, aciertos, tiempo_promedio_seg, actualizado_en)
  SELECT pregunta_id, intentos, aciertos, tiempo, now() FROM nuevas
  ON CONFLICT (pregunta_id) DO UPDATE
     SET intentos = EXCLUDED.intentos, aciertos = EXCLUDED.aciertos,
         tiempo_promedio_seg = EXCLUDED.tiempo_promedio_seg, actualizado_en = EXCLUDED.actualizado_en
   WHERE (s.intentos, s.aciertos, s.tiempo_promedio_seg)
         IS DISTINCT FROM (EXCLUDED.intentos, EXCLUDED.aciertos, EXCLUDED.tiempo_promedio_seg)`;

export function crearEstadisticasRepositorio(bd: Ejecutor) {
  return {
    /** Recalcula todas las estadísticas; devuelve cuántas filas cambiaron. */
    async recalcular(): Promise<number> {
      const resultado = await bd.query(SQL_RECALCULAR);
      return resultado.rowCount ?? 0;
    },
    /** Las estadísticas de esas preguntas; las que nunca tuvieron respuestas no aparecen. */
    async leer(preguntaIds: string[]): Promise<EstadisticaPregunta[]> {
      if (preguntaIds.length === 0) return [];
      const { rows } = await bd.query<EstadisticaPregunta>(
        `SELECT pregunta_id::text AS "preguntaId", intentos, aciertos,
                ROUND(100.0 * aciertos / NULLIF(intentos, 0), 1)::float8 AS "porcentajeAcierto",
                tiempo_promedio_seg AS "tiempoPromedioSeg", actualizado_en AS "actualizadoEn"
           FROM app.estadistica_pregunta WHERE pregunta_id = ANY($1::bigint[]) ORDER BY pregunta_id`,
        [preguntaIds],
      );
      return rows;
    },
    /** Las publicadas con al menos esos intentos cuyo acierto no cae en el rango de su dificultad. */
    async fueraDeRango(minIntentos: number): Promise<EstadisticaFueraDeRango[]> {
      const { rows } = await bd.query<FilaFueraDeRango>(SQL_FUERA_DE_RANGO, [minIntentos]);
      return rows.map(conDificultad);
    },
  };
}
