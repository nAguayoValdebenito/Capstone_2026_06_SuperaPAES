// Único lugar con SQL del módulo preguntas. Consultas siempre parametrizadas ($1, $2...).
// Tablas que pertenecen a este módulo (ningún otro módulo las escribe):
//   - contenido.pregunta
//   - contenido.alternativa
//   - contenido.pregunta_version
//   - contenido.texto_estimulo
//   - contenido.importacion
//   - contenido.historial_estado_pregunta (lo registra la base)
//   - contenido.transicion_estado_pregunta (solo lectura: la carga la migración)
//   - app.reporte_pregunta
//   - función app.anular_pregunta
// Lee por su código las listas de opciones contenido.estado_pregunta y contenido.dificultad. El temario
// (pruebas, ejes, contenidos y habilidades) no se lee aquí: lo entrega el servicio de temario.
// Cada método recibe un Ejecutor opcional (tx) para sumarse a la transacción del servicio.
import type { Ejecutor } from '../../db/transaccion.js';
import type { OrigenPregunta } from './preguntas.validadores.js';

/** Opción de una lista (estado_pregunta, dificultad): se identifica por su código. */
export interface Opcion {
  codigo: string;
  nombre: string;
}

/** Filtros ya resueltos por el servicio: el eje se convierte en la lista de sus contenidos. */
export interface ConsultaBanco {
  pruebaId?: number | undefined;
  contenidoIds?: readonly number[] | undefined;
  habilidadId?: number | undefined;
  estado?: string | undefined;
  origen?: OrigenPregunta | undefined;
  dificultad?: string | undefined;
  limite: number;
  desde: number;
}

/** Fila del banco. Nunca trae la alternativa correcta: el banco solo lista. */
export interface FilaBanco {
  id: string;
  resumen: string;
  pruebaId: number;
  contenidoId: number;
  estado: Opcion;
  origen: OrigenPregunta;
  dificultadSugerida: Opcion | null;
  dificultadAsignada: Opcion | null;
  posibleAmbigua: boolean;
  actualizadoEn: Date;
}

export interface PreguntasRepositorio {
  listarBanco(
    consulta: ConsultaBanco,
    tx?: Ejecutor,
  ): Promise<{ filas: FilaBanco[]; total: number }>;
  listarEstados(tx?: Ejecutor): Promise<Opcion[]>;
  listarDificultades(tx?: Ejecutor): Promise<Opcion[]>;
}

/** Largo del resumen del enunciado que se muestra en la tabla del banco. */
const LARGO_RESUMEN = 160;

/** Mismo criterio que la vista contenido.v_calidad_criterio del modelo. */
const ORIGEN = `CASE WHEN p.lote_id IS NOT NULL THEN 'ia'
                     WHEN p.importacion_id IS NOT NULL THEN 'importacion'
                     ELSE 'manual' END`;

const opcionJson = (alias: string) =>
  `CASE WHEN ${alias}.id IS NULL THEN NULL
        ELSE json_build_object('codigo', ${alias}.codigo, 'nombre', ${alias}.nombre) END`;

/** Preguntas que cumplen los filtros ($1 a $6); un filtro en NULL no se aplica. */
const PREGUNTAS_FILTRADAS = `
    FROM contenido.pregunta p
    JOIN contenido.estado_pregunta ep ON ep.id = p.estado_pregunta_id
    LEFT JOIN contenido.dificultad ds ON ds.id = p.dificultad_sugerida_id
    LEFT JOIN contenido.dificultad da ON da.id = p.dificultad_asignada_id
   WHERE ($1::smallint IS NULL OR p.prueba_id = $1)
     AND ($2::int[] IS NULL OR p.contenido_id = ANY ($2))
     AND ($3::smallint IS NULL OR p.habilidad_id = $3)
     AND ($4::text IS NULL OR ep.codigo = $4)
     AND ($5::text IS NULL OR ${ORIGEN} = $5)
     AND ($6::text IS NULL OR da.codigo = $6)`;

// count(*) OVER () cuenta todas las filas del filtro antes de LIMIT, en la misma consulta.
const BANCO = `
  SELECT p.id::text AS id, left(p.enunciado, ${String(LARGO_RESUMEN)}) AS resumen,
         p.prueba_id AS "pruebaId", p.contenido_id AS "contenidoId",
         json_build_object('codigo', ep.codigo, 'nombre', ep.nombre) AS estado,
         ${ORIGEN} AS origen,
         ${opcionJson('ds')} AS "dificultadSugerida",
         ${opcionJson('da')} AS "dificultadAsignada",
         p.posible_ambigua AS "posibleAmbigua",
         p.actualizado_en AS "actualizadoEn",
         count(*) OVER ()::int AS total
  ${PREGUNTAS_FILTRADAS}
   ORDER BY p.actualizado_en DESC, p.id DESC
   LIMIT $7 OFFSET $8`;

/** El total, cuando la página pedida queda después de la última fila y no trae ninguna. */
const TOTAL_BANCO = `SELECT count(*)::int AS total ${PREGUNTAS_FILTRADAS}`;

type FilaConTotal = FilaBanco & { total: number };

/** $1 a $6 de PREGUNTAS_FILTRADAS: un filtro que no viene va como NULL y no se aplica. */
const parametrosDelFiltro = (consulta: ConsultaBanco) => [
  consulta.pruebaId ?? null,
  consulta.contenidoIds ?? null,
  consulta.habilidadId ?? null,
  consulta.estado ?? null,
  consulta.origen ?? null,
  consulta.dificultad ?? null,
];

export function crearPreguntasRepositorio(bd: Ejecutor): PreguntasRepositorio {
  return {
    async listarBanco(consulta, tx = bd) {
      const parametros = parametrosDelFiltro(consulta);
      const { rows } = await tx.query<FilaConTotal>(BANCO, [
        ...parametros,
        consulta.limite,
        consulta.desde,
      ]);
      if (rows.length === 0 && consulta.desde > 0) {
        const conteo = await tx.query<{ total: number }>(TOTAL_BANCO, parametros);
        return { filas: [], total: conteo.rows[0]?.total ?? 0 };
      }
      const total = rows[0]?.total ?? 0;
      return { filas: rows.map(({ total: _total, ...fila }) => fila), total };
    },

    async listarEstados(tx = bd) {
      const { rows } = await tx.query<Opcion>(
        'SELECT codigo, nombre FROM contenido.estado_pregunta ORDER BY id',
      );
      return rows;
    },

    async listarDificultades(tx = bd) {
      const { rows } = await tx.query<Opcion>(
        'SELECT codigo, nombre FROM contenido.dificultad ORDER BY orden',
      );
      return rows;
    },
  };
}
