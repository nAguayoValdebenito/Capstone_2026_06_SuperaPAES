// Persistencia del resultado y la revisión de cualquier evaluación (HU-61.1). El resultado lo calculó la
// base al cerrar (calcular_resultado); la revisión sale de v_revision_evaluacion, con la versión de cada
// pregunta que vio el estudiante.
import type { Ejecutor } from '../../db/transaccion.js';
import {
  RESULTADO_POR_EJE_Y_HABILIDAD,
  type ResultadoDeGrupo,
} from './evaluaciones.resumen.repositorio.js';

export interface EvaluacionParaConsulta {
  cerradaEn: Date | null;
  /** Con tiempo y con la hora de término cumplida según la base (RN-21). */
  vencida: boolean;
}

interface Codigo {
  codigo: string;
  nombre: string;
}

export interface ResultadoEvaluacion {
  id: string;
  tipo: Codigo;
  prueba: Codigo & { id: number };
  estado: Codigo;
  iniciadaEn: Date;
  cerradaEn: Date;
  duracionMin: number | null;
  cantidad: number;
  puntuables: number;
  correctas: number;
  incorrectas: number;
  omitidas: number;
  porcentaje: number;
  tiempoUsadoSeg: number;
  puntaje: number | null;
  tablaConversion: { anioAdmision: number; proceso: string } | null;
  recalculadoEn: Date | null;
  ejes: ResultadoDeGrupo[];
  habilidades: ResultadoDeGrupo[];
}

export interface PreguntaRevisada {
  orden: number;
  preguntaId: string;
  eje: { id: number; nombre: string };
  resultado: 'correcta' | 'incorrecta' | 'omitida';
  puntuable: boolean;
  anulada: boolean;
  texto: { titulo: string | null; contenido: string | null; imagenUrl: string | null } | null;
  enunciado: string;
  explicacion: string;
  alternativaElegidaId: string | null;
  alternativaCorrectaId: string;
  alternativas: { id: number; letra: string; texto: string; explicacion: string | null }[];
}

const CONSULTA_RESULTADO = `SELECT e.id::text AS id,
  jsonb_build_object('codigo', t.codigo, 'nombre', t.nombre) AS tipo,
  jsonb_build_object('id', p.id, 'codigo', p.codigo, 'nombre', p.nombre) AS prueba,
  jsonb_build_object('codigo', ee.codigo, 'nombre', ee.nombre) AS estado,
  e.iniciada_en AS "iniciadaEn", e.cerrada_en AS "cerradaEn", e.duracion_min AS "duracionMin",
  e.cantidad_preguntas AS cantidad, r.puntuables, r.correctas, r.incorrectas, r.omitidas,
  r.porcentaje::float8 AS porcentaje, r.tiempo_usado_seg AS "tiempoUsadoSeg", r.puntaje,
  CASE WHEN tc.id IS NOT NULL THEN
    jsonb_build_object('anioAdmision', tc.anio_admision, 'proceso', pa.nombre)
  END AS "tablaConversion",
  r.recalculado_en AS "recalculadoEn",
  ${RESULTADO_POR_EJE_Y_HABILIDAD}
 FROM app.evaluacion e
 JOIN contenido.tipo_evaluacion t ON t.id=e.tipo_evaluacion_id
 JOIN contenido.prueba p ON p.id=e.prueba_id
 JOIN contenido.estado_evaluacion ee ON ee.id=e.estado_evaluacion_id
 JOIN app.resultado_evaluacion r ON r.evaluacion_id=e.id
 LEFT JOIN contenido.tabla_conversion tc ON tc.id=r.tabla_conversion_id
 LEFT JOIN contenido.proceso_admision pa ON pa.id=tc.proceso_admision_id
 WHERE e.id=$1 AND e.estudiante_id=$2`;

// En la práctica y el repaso solo cuentan las respondidas (RN-22): la que quedó sin responder al
// cerrar no se revisa. En las demás, las sin responder son omitidas.
const CONSULTA_REVISION = `SELECT r.orden, r.pregunta_id::text AS "preguntaId",
  jsonb_build_object('id', ej.id, 'nombre', ej.nombre) AS eje,
  CASE
    WHEN r.alternativa_elegida IS NULL THEN 'omitida'
    WHEN r.es_correcta THEN 'correcta'
    ELSE 'incorrecta'
  END AS resultado,
  r.puntuable, r.anulada,
  CASE WHEN tx.id IS NOT NULL THEN
    jsonb_build_object('titulo', tx.titulo, 'contenido', tx.contenido, 'imagenUrl', tx.imagen_url)
  END AS texto,
  r.enunciado, r.explicacion,
  r.alternativa_elegida::text AS "alternativaElegidaId",
  r.alternativa_correcta_id::text AS "alternativaCorrectaId",
  (SELECT jsonb_agg(
     jsonb_build_object(
       'id', a -> 'id', 'letra', a -> 'letra', 'texto', a -> 'texto', 'explicacion', a -> 'explicacion'
     ) ORDER BY a ->> 'letra')
   FROM jsonb_array_elements(r.alternativas) a) AS alternativas
 FROM app.v_revision_evaluacion r
 JOIN app.evaluacion e ON e.id=r.evaluacion_id
 JOIN contenido.tipo_evaluacion te ON te.id=e.tipo_evaluacion_id
 JOIN contenido.pregunta_version v ON (v.pregunta_id, v.version)=(r.pregunta_id, r.version_pregunta)
 JOIN contenido.eje_tematico ej ON ej.id=v.eje_id
 LEFT JOIN contenido.texto_estimulo tx ON tx.id=(v.copia ->> 'texto_estimulo_id')::bigint
 WHERE r.evaluacion_id=$1 AND e.estudiante_id=$2
   AND (NOT te.correccion_inmediata OR r.alternativa_elegida IS NOT NULL)
 ORDER BY r.orden`;

const consultasResultado = {
  async bloquearEvaluacion(
    id: string,
    estudianteId: string,
    tx: Ejecutor,
  ): Promise<EvaluacionParaConsulta | null> {
    const { rows } = await tx.query<EvaluacionParaConsulta>(
      `SELECT cerrada_en AS "cerradaEn", COALESCE(vence_en <= now(), false) AS vencida
         FROM app.evaluacion WHERE id=$1 AND estudiante_id=$2 FOR UPDATE`,
      [id, estudianteId],
    );
    return rows[0] ?? null;
  },
  /** RN-21: la base la cierra con su hora de término y la corrige. */
  async cerrarPorTiempo(id: string, tx: Ejecutor): Promise<void> {
    await tx.query("SELECT app.cerrar_evaluacion($1, 'tiempo_agotado')", [id]);
  },
  async leerResultado(
    id: string,
    estudianteId: string,
    tx: Ejecutor,
  ): Promise<ResultadoEvaluacion | null> {
    const { rows } = await tx.query<ResultadoEvaluacion>(CONSULTA_RESULTADO, [id, estudianteId]);
    return rows[0] ?? null;
  },
  async leerRevision(id: string, estudianteId: string, tx: Ejecutor): Promise<PreguntaRevisada[]> {
    const { rows } = await tx.query<PreguntaRevisada>(CONSULTA_REVISION, [id, estudianteId]);
    return rows;
  },
};

export function crearResultadoRepositorio() {
  return consultasResultado;
}

export type ResultadoRepositorio = ReturnType<typeof crearResultadoRepositorio>;
