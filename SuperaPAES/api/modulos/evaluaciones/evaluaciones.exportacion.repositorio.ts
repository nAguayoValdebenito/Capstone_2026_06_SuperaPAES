// Lo que la descarga de datos (HU-07.1, RF-A18) toma de las evaluaciones del estudiante: cada una con
// su resultado, si se calculó, y sus preguntas con la alternativa que eligió y si acertó.
import type { Ejecutor } from '../../db/transaccion.js';

export interface FilaEvaluacionExportada {
  id: string;
  /** Código de contenido.tipo_evaluacion: practica, repaso, diagnostico, mini_ensayo... */
  tipo: string;
  pruebaCodigo: string;
  pruebaNombre: string;
  /** Código de contenido.estado_evaluacion. */
  estado: string;
  iniciadaEn: Date;
  cerradaEn: Date | null;
  cantidadPreguntas: number;
  /** null mientras la evaluación no tenga resultado. */
  correctas: number | null;
  incorrectas: number | null;
  omitidas: number | null;
  porcentaje: number | null;
  /** Solo el ensayo completo entrega puntaje (RN-23). */
  puntaje: number | null;
  tiempoUsadoSeg: number | null;
}

export interface FilaRespuestaExportada {
  evaluacionId: string;
  orden: number;
  preguntaId: string;
  /** Letra elegida; null si no la respondió. */
  alternativa: string | null;
  correcta: boolean | null;
  respondidaEn: Date | null;
  tiempoSeg: number | null;
}

const EVALUACIONES = `
  SELECT e.id::text AS id, te.codigo AS tipo, p.codigo AS "pruebaCodigo", p.nombre AS "pruebaNombre",
         ee.codigo AS estado, e.iniciada_en AS "iniciadaEn", e.cerrada_en AS "cerradaEn",
         e.cantidad_preguntas AS "cantidadPreguntas", r.correctas, r.incorrectas, r.omitidas,
         r.porcentaje::float8 AS porcentaje, r.puntaje, r.tiempo_usado_seg AS "tiempoUsadoSeg"
    FROM app.evaluacion e
    JOIN contenido.tipo_evaluacion te ON te.id = e.tipo_evaluacion_id
    JOIN contenido.prueba p ON p.id = e.prueba_id
    JOIN contenido.estado_evaluacion ee ON ee.id = e.estado_evaluacion_id
    LEFT JOIN app.resultado_evaluacion r ON r.evaluacion_id = e.id
   WHERE e.estudiante_id = $1
   ORDER BY e.iniciada_en, e.id`;

const RESPUESTAS = `
  SELECT i.evaluacion_id::text AS "evaluacionId", i.orden, i.pregunta_id::text AS "preguntaId",
         a.letra AS alternativa, i.es_correcta AS correcta, i.respondida_en AS "respondidaEn",
         i.tiempo_seg AS "tiempoSeg"
    FROM app.evaluacion_item i
    JOIN app.evaluacion e ON e.id = i.evaluacion_id
    LEFT JOIN contenido.alternativa a ON a.id = i.alternativa_id
   WHERE e.estudiante_id = $1
   ORDER BY i.evaluacion_id, i.orden`;

export function crearExportacionRepositorio(bd: Ejecutor) {
  return {
    async evaluaciones(estudianteId: string, tx: Ejecutor = bd) {
      const { rows } = await tx.query<FilaEvaluacionExportada>(EVALUACIONES, [estudianteId]);
      return rows;
    },

    async respuestas(estudianteId: string, tx: Ejecutor = bd) {
      const { rows } = await tx.query<FilaRespuestaExportada>(RESPUESTAS, [estudianteId]);
      return rows;
    },
  };
}
