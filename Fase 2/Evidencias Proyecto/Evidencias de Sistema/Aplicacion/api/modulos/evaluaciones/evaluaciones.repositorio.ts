// Único lugar con SQL del módulo evaluaciones. Consultas siempre parametrizadas ($1, $2...).
// Tablas que pertenecen a este módulo (ningún otro módulo las escribe):
//   - app.evaluacion
//   - app.evaluacion_item
//   - app.resultado_evaluacion, app.resultado_eje y app.resultado_habilidad (los calcula la base al cerrar)
//   - app.estadistica_pregunta
//   - contenido.estructura_evaluacion y contenido.estructura_detalle (reparto por eje, RN-35)
//   - contenido.tabla_conversion y contenido.tabla_conversion_fila (tablas del DEMRE, RN-23)
//   - funciones app.cerrar_evaluacion, app.cerrar_vencidas y app.calcular_resultado
//   - vista contenido.v_preguntas_publicadas
//   - vista app.v_item_evaluacion: lo único que la app recibe de cada pregunta (RN-06), sin la clave ni
//     las explicaciones hasta que el ítem se corrige
//   - vistas app.v_historial, app.v_revision_evaluacion y app.v_respuesta_valida
//   - vistas app.v_progreso_eje, app.v_progreso_habilidad, app.v_evolucion_semanal y app.v_preguntas_falladas
// Cada método recibe un Ejecutor opcional (tx) para sumarse a la transacción del servicio.
import type { Ejecutor } from '../../db/transaccion.js';
import type {
  CandidataSeleccion,
  FiltrosSeleccion,
  HistorialEntrega,
  ObjetivoDificultad,
  ParametrosSeleccion,
} from './evaluaciones.seleccion.tipos.js';

export interface EvaluacionesRepositorio {
  contarDisponibles(
    datos: FiltrosSeleccion,
    parametros: ParametrosSeleccion,
    tx?: Ejecutor,
  ): Promise<number>;
  buscarCandidatas(
    datos: FiltrosSeleccion,
    parametros: ParametrosSeleccion,
    tx?: Ejecutor,
  ): Promise<CandidataSeleccion[]>;
  leerEntregadas(
    datos: FiltrosSeleccion,
    parametros: ParametrosSeleccion,
    tx?: Ejecutor,
  ): Promise<HistorialEntrega[]>;
  leerMezcla(tx?: Ejecutor): Promise<ObjetivoDificultad[]>;
}

// Una única consulta base mantiene idénticos los filtros de conteo y selección. Ninguna columna
// de claves ni explicaciones entra al servicio; solo clasificación de la vista pública vigente.
const CANDIDATAS = `
  SELECT v.id::text AS "preguntaId", v.version, pv.eje_id AS "ejeId", pv.habilidad_id AS "habilidadId",
    d.codigo AS dificultad, v.texto_estimulo_id::text AS "textoId", v.orden_en_texto AS "ordenEnTexto",
    (v.prueba = 'CL') AS lectora,
    CASE WHEN v.prueba = 'CL' THEN
      COALESCE(ph.respondidas >= $13 AND COALESCE(ph.acierto_ponderado, 0) < $14, false)
      ELSE COALESCE(pe.a_reforzar, false) END AS debil
  FROM contenido.v_preguntas_publicadas v JOIN contenido.pregunta p ON p.id = v.id
  JOIN contenido.pregunta_version pv ON pv.pregunta_id = v.id AND pv.version = v.version
  JOIN contenido.dificultad d ON d.id = pv.dificultad_id
  JOIN contenido.contenido_tematico ct ON ct.id = pv.contenido_id
  JOIN app.estudiante es ON es.id = $1 AND es.eliminado_en IS NULL
  LEFT JOIN contenido.nivel_escolar ne ON ne.id = CASE WHEN $8::boolean THEN $7::smallint
    ELSE app.nivel_escolar_en(es.anio_egreso, ($9::timestamptz AT TIME ZONE 'America/Santiago')::date) END
  LEFT JOIN contenido.nivel_escolar nc ON nc.id = ct.nivel_escolar_id
  LEFT JOIN app.v_progreso_eje pe ON pe.estudiante_id = es.id AND pe.prueba_id = p.prueba_id AND pe.eje_id = pv.eje_id
  LEFT JOIN app.v_progreso_habilidad ph ON ph.estudiante_id = es.id AND ph.prueba_id = p.prueba_id AND ph.habilidad_id = pv.habilidad_id
  WHERE p.prueba_id = $2 AND ($3::smallint IS NULL OR pv.eje_id = $3)
    AND ($4::integer IS NULL OR pv.contenido_id = $4) AND ($5::smallint IS NULL OR pv.habilidad_id = $5)
    AND ($6::text IS NULL OR d.codigo = $6)
    AND (NOT $8::boolean OR $7::smallint IS NULL OR ne.id IS NOT NULL)
    AND (v.prueba = 'CL' OR nc.orden IS NULL OR ne.orden IS NULL OR nc.orden <= ne.orden)
    AND NOT (v.id = ANY($12::bigint[]))
    AND NOT EXISTS (SELECT 1 FROM app.v_respuesta_valida r
      WHERE r.estudiante_id = $1 AND r.pregunta_id = v.id AND r.es_correcta
        AND r.fecha >= $10::timestamptz - $11::integer * INTERVAL '24 hours' AND r.fecha <= $10)`;

function valores(datos: FiltrosSeleccion, p: ParametrosSeleccion): unknown[] {
  return [
    datos.estudianteId,
    datos.pruebaId,
    datos.ejeId ?? null,
    datos.contenidoId ?? null,
    datos.habilidadId ?? null,
    datos.dificultad ?? null,
    datos.nivelEscolarId ?? null,
    datos.nivelEscolarId !== undefined,
    datos.iniciadaEn,
    p.ahora,
    p.diasSinRepetir,
    datos.entregadas.map((e) => e.preguntaId),
    p.minRespuestas,
    p.umbralDebil,
  ];
}

const ENTREGADAS = `SELECT v.pregunta_id::text AS "preguntaId", v.version,
    v.eje_id AS "ejeId", v.habilidad_id AS "habilidadId", d.codigo AS dificultad,
    v.copia ->> 'texto_estimulo_id' AS "textoId",
    CASE WHEN pr.codigo = 'CL' THEN
      COALESCE(ph.respondidas >= $5 AND COALESCE(ph.acierto_ponderado, 0) < $6, false)
      ELSE COALESCE(pe.a_reforzar, false) END AS debil
  FROM unnest($1::bigint[], $2::integer[]) WITH ORDINALITY pedido(id, version, orden)
  JOIN contenido.pregunta_version v ON v.pregunta_id = pedido.id AND v.version = pedido.version
  JOIN contenido.pregunta p ON p.id = v.pregunta_id AND p.prueba_id = $3
  JOIN contenido.prueba pr ON pr.id = p.prueba_id JOIN contenido.dificultad d ON d.id = v.dificultad_id
  LEFT JOIN app.v_progreso_eje pe ON pe.estudiante_id = $4 AND pe.prueba_id = p.prueba_id AND pe.eje_id = v.eje_id
  LEFT JOIN app.v_progreso_habilidad ph ON ph.estudiante_id = $4 AND ph.prueba_id = p.prueba_id AND ph.habilidad_id = v.habilidad_id
  ORDER BY pedido.orden`;

export function crearEvaluacionesRepositorio(bd: Ejecutor): EvaluacionesRepositorio {
  return {
    async contarDisponibles(datos, parametros, tx = bd) {
      const {
        rows: [fila],
      } = await tx.query<{ total: number }>(
        `SELECT count(*)::int AS total FROM (${CANDIDATAS}) candidatas`,
        valores(datos, parametros),
      );
      return fila?.total ?? 0;
    },
    async buscarCandidatas(datos, parametros, tx = bd) {
      const { rows } = await tx.query<CandidataSeleccion>(
        `${CANDIDATAS} ORDER BY v.id`,
        valores(datos, parametros),
      );
      return rows;
    },
    async leerEntregadas(datos, parametros, tx = bd) {
      if (datos.entregadas.length === 0) return [];
      const { rows } = await tx.query<HistorialEntrega>(ENTREGADAS, [
        datos.entregadas.map((e) => e.preguntaId),
        datos.entregadas.map((e) => e.version),
        datos.pruebaId,
        datos.estudianteId,
        parametros.minRespuestas,
        parametros.umbralDebil,
      ]);
      return rows;
    },
    async leerMezcla(tx = bd) {
      const { rows } = await tx.query<ObjetivoDificultad>(
        'SELECT codigo, mezcla_objetivo AS objetivo FROM contenido.dificultad ORDER BY orden',
      );
      return rows;
    },
  };
}
