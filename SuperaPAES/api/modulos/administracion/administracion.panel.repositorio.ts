// SQL del Panel (C01, HU-48, CU-25, RF-C06). Solo lee y solo entrega cifras agregadas: ningún dato personal
// (RNF-09). Lee tablas de otros módulos sin escribirlas, porque cada indicador cruza varios. Días en hora de Chile.
import type { Ejecutor } from '../../db/transaccion.js';

export type Periodo = 'hoy' | '7d' | '30d' | 'mes';

export interface Rango {
  desde: string;
  hasta: string;
}

export interface Cantidad {
  nombre: string;
  total: number;
}

export interface RespuestasDelDia {
  dia: string;
  total: number;
}

const DIA = (columna: string) => `(${columna} AT TIME ZONE 'America/Santiago')::date`;

const EN_RANGO = (columna: string) => `${DIA(columna)} BETWEEN $1::date AND $2::date`;

const RANGO = `
  WITH hoy AS (SELECT ${DIA('$1::timestamptz')} AS dia)
  SELECT to_char(CASE $2::text
                   WHEN 'hoy' THEN dia
                   WHEN '7d' THEN dia - 6
                   WHEN 'mes' THEN date_trunc('month', dia)::date
                   ELSE dia - 29
                 END, 'YYYY-MM-DD') AS desde,
         to_char(dia, 'YYYY-MM-DD') AS hasta
    FROM hoy`;

const ESTUDIANTES = `
  SELECT (SELECT count(*)::int FROM app.estudiante WHERE eliminado_en IS NULL) AS registrados,
         (SELECT count(DISTINCT ev.estudiante_id)::int
            FROM app.evaluacion_item i
            JOIN app.evaluacion ev ON ev.id = i.evaluacion_id
           WHERE ${EN_RANGO('i.respondida_en')}) AS activos`;

const POR_ESTADO = `
  SELECT e.nombre, count(p.id)::int AS total
    FROM contenido.estado_pregunta e
    LEFT JOIN contenido.pregunta p ON p.estado_pregunta_id = e.id
   GROUP BY e.id, e.nombre ORDER BY e.id`;

const POR_DIFICULTAD = `
  SELECT COALESCE(d.nombre, 'Sin asignar') AS nombre, count(*)::int AS total
    FROM contenido.pregunta p
    LEFT JOIN contenido.dificultad d ON d.id = p.dificultad_asignada_id
   GROUP BY d.id, d.nombre ORDER BY d.id NULLS LAST`;

const RESPUESTAS_POR_DIA = `
  SELECT to_char(serie.dia, 'YYYY-MM-DD') AS dia, count(i.id)::int AS total
    FROM generate_series($1::date, $2::date, interval '1 day') AS serie(dia)
    LEFT JOIN app.evaluacion_item i ON ${DIA('i.respondida_en')} = serie.dia::date
   GROUP BY serie.dia ORDER BY serie.dia`;

const SUSCRIPCIONES = `
  SELECT count(*) FILTER (WHERE e.codigo IN ('activa', 'en_mora'))::int AS vigentes,
         count(*) FILTER (WHERE ${EN_RANGO('s.inicio')})::int AS nuevas,
         count(*) FILTER (WHERE ${EN_RANGO('s.cancelada_en')})::int AS canceladas
    FROM app.suscripcion s
    JOIN contenido.estado_suscripcion e ON e.id = s.estado_suscripcion_id`;

/** Preguntas de la IA cuya última revisión terminó en el período y ya tienen resultado. */
const REVISION_IA = `
  SELECT count(*)::int AS revisadas,
         count(*) FILTER (WHERE e.codigo <> 'rechazada')::int AS aprobadas
    FROM contenido.pregunta p
    JOIN contenido.estado_pregunta e ON e.id = p.estado_pregunta_id
   WHERE p.lote_id IS NOT NULL
     AND e.codigo IN ('aprobada', 'publicada', 'retirada', 'rechazada')
     AND ${DIA(
       `(SELECT max(a.completado_en) FROM contenido.asignacion_revision a WHERE a.pregunta_id = p.id)`,
     )} BETWEEN $1::date AND $2::date`;

export function crearPanelRepositorio(bd: Ejecutor) {
  const uno = async <T extends object>(sql: string, valores: unknown[]): Promise<T> => {
    const { rows } = await bd.query<T>(sql, valores);
    return rows[0]!;
  };
  return {
    rango: (ahora: Date, periodo: Periodo) => uno<Rango>(RANGO, [ahora, periodo]),
    estudiantes: ({ desde, hasta }: Rango) =>
      uno<{ registrados: number; activos: number }>(ESTUDIANTES, [desde, hasta]),
    suscripciones: ({ desde, hasta }: Rango) =>
      uno<{ vigentes: number; nuevas: number; canceladas: number }>(SUSCRIPCIONES, [desde, hasta]),
    revisionIa: ({ desde, hasta }: Rango) =>
      uno<{ revisadas: number; aprobadas: number }>(REVISION_IA, [desde, hasta]),
    async preguntasPorEstado(): Promise<Cantidad[]> {
      return (await bd.query<Cantidad>(POR_ESTADO)).rows;
    },
    async preguntasPorDificultad(): Promise<Cantidad[]> {
      return (await bd.query<Cantidad>(POR_DIFICULTAD)).rows;
    },
    async respuestasPorDia({ desde, hasta }: Rango): Promise<RespuestasDelDia[]> {
      return (await bd.query<RespuestasDelDia>(RESPUESTAS_POR_DIA, [desde, hasta])).rows;
    },
  };
}

export type PanelRepositorio = ReturnType<typeof crearPanelRepositorio>;
