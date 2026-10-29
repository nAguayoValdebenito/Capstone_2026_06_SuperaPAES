// Persistencia del cierre y resumen de prácticas. La base corrige y calcula; este repositorio solo
// bloquea, llama una vez a cerrar_evaluacion y lee el resultado guardado con su clasificación.
import type { Ejecutor } from '../../db/transaccion.js';

export interface PracticaParaCierre {
  cerradaEn: Date | null;
}

export interface ResumenPractica {
  id: string;
  prueba: { id: number; codigo: string; nombre: string };
  alcance: { tipo: 'prueba' | 'eje' | 'contenido' | 'habilidad'; id: number; nombre: string };
  dificultad: { id: number | null; codigo: string; nombre: string };
  cantidad: number;
  respondidas: number;
  correctas: number;
  incorrectas: number;
  omitidas: number;
  porcentaje: number;
  tiempoUsadoSeg: number;
  ejes: ResultadoDeGrupo[];
  habilidades: ResultadoDeGrupo[];
}

/**
 * Columnas `ejes` y `habilidades` del resultado guardado de la evaluación `e` (A21 y A30): preguntas y
 * correctas de cada uno, los ejes en su orden del temario.
 */
export const RESULTADO_POR_EJE_Y_HABILIDAD = `COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', re.eje_id, 'nombre', eje.nombre,
        'preguntas', re.preguntas, 'correctas', re.correctas
      ) ORDER BY eje.orden
    )
    FROM app.resultado_eje re
    JOIN contenido.eje_tematico eje ON eje.id=re.eje_id
    WHERE re.evaluacion_id=e.id
  ), '[]'::jsonb) AS ejes,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', rh.habilidad_id, 'nombre', hab.nombre,
        'preguntas', rh.preguntas, 'correctas', rh.correctas
      ) ORDER BY hab.nombre, hab.id
    )
    FROM app.resultado_habilidad rh
    JOIN contenido.habilidad hab ON hab.id=rh.habilidad_id
    WHERE rh.evaluacion_id=e.id
  ), '[]'::jsonb) AS habilidades`;

/** Preguntas y correctas de un eje o una habilidad en el resultado guardado. */
export interface ResultadoDeGrupo {
  id: number;
  nombre: string;
  preguntas: number;
  correctas: number;
}

const CONSULTA_RESUMEN = `SELECT e.id::text AS id,
  jsonb_build_object('id', p.id, 'codigo', p.codigo, 'nombre', p.nombre) AS prueba,
  CASE
    WHEN e.eje_id IS NOT NULL THEN
      jsonb_build_object('tipo', 'eje', 'id', ej.id, 'nombre', ej.nombre)
    WHEN e.contenido_id IS NOT NULL THEN
      jsonb_build_object('tipo', 'contenido', 'id', c.id, 'nombre', c.nombre)
    WHEN e.habilidad_id IS NOT NULL THEN
      jsonb_build_object('tipo', 'habilidad', 'id', h.id, 'nombre', h.nombre)
    ELSE jsonb_build_object('tipo', 'prueba', 'id', p.id, 'nombre', p.nombre)
  END AS alcance,
  jsonb_build_object(
    'id', d.id, 'codigo', COALESCE(d.codigo, 'mezcla'),
    'nombre', COALESCE(d.nombre, 'Mezcla')
  ) AS dificultad,
  e.cantidad_preguntas AS cantidad, r.puntuables AS respondidas,
  r.correctas, r.incorrectas, r.omitidas, r.porcentaje::float8 AS porcentaje,
  r.tiempo_usado_seg AS "tiempoUsadoSeg",
  ${RESULTADO_POR_EJE_Y_HABILIDAD}
 FROM app.evaluacion e
 JOIN contenido.tipo_evaluacion t ON t.id=e.tipo_evaluacion_id
 JOIN contenido.prueba p ON p.id=e.prueba_id
 JOIN app.resultado_evaluacion r ON r.evaluacion_id=e.id
 LEFT JOIN contenido.eje_tematico ej ON ej.id=e.eje_id
 LEFT JOIN contenido.contenido_tematico c ON c.id=e.contenido_id
 LEFT JOIN contenido.habilidad h ON h.id=e.habilidad_id
 LEFT JOIN contenido.dificultad d ON d.id=e.dificultad_id
 WHERE e.id=$1 AND e.estudiante_id=$2 AND t.codigo='practica'`;

const consultasResumen = {
  async bloquearPractica(
    id: string,
    estudianteId: string,
    tx: Ejecutor,
  ): Promise<PracticaParaCierre | null> {
    const { rows } = await tx.query<PracticaParaCierre>(
      `SELECT e.cerrada_en AS "cerradaEn" FROM app.evaluacion e
       JOIN contenido.tipo_evaluacion t ON t.id=e.tipo_evaluacion_id
       WHERE e.id=$1 AND e.estudiante_id=$2 AND t.codigo='practica' FOR UPDATE OF e`,
      [id, estudianteId],
    );
    return rows[0] ?? null;
  },
  async cerrarEntregada(id: string, tx: Ejecutor): Promise<void> {
    await tx.query("SELECT app.cerrar_evaluacion($1, 'entregada')", [id]);
  },
  async leerResumen(
    id: string,
    estudianteId: string,
    tx: Ejecutor,
  ): Promise<ResumenPractica | null> {
    const { rows } = await tx.query<ResumenPractica>(CONSULTA_RESUMEN, [id, estudianteId]);
    return rows[0] ?? null;
  },
};

export function crearResumenRepositorio() {
  return consultasResumen;
}

export type ResumenRepositorio = ReturnType<typeof crearResumenRepositorio>;
