// Persistencia del repaso de errores (HU-39.1, RF-A15, A24). Sale de app.v_preguntas_falladas: las preguntas cuya
// última respuesta fue incorrecta u omitida. Solo las que siguen publicadas, con su versión vigente, porque es
// la única que se puede entregar. `limite` deja las más recientes del estudiante (RN-04); `null`, todas.
import type { Ejecutor } from '../../db/transaccion.js';
import type { PreguntaSeleccionada } from './evaluaciones.seleccion.tipos.js';

export interface EstructuraRepaso {
  id: number;
  /** El repaso tiene hasta este máximo de preguntas (5 a 10, DAS 4.2.5). */
  cantidadMax: number;
}

/** Una prueba y un eje con sus preguntas por repasar. */
export interface FilaPorRepasar {
  pruebaId: number;
  pruebaCodigo: string;
  pruebaNombre: string;
  ejeId: number;
  ejeNombre: string;
  preguntas: number;
}

export interface FiltroRepaso {
  estudianteId: string;
  /** Preguntas más recientes que se pueden repasar; `null` con el plan Todas las pruebas. */
  limite: number | null;
  pruebaId: number;
  ejeId?: number;
}

export interface NuevoRepaso {
  estudianteId: string;
  pruebaId: number;
  estructuraId: number;
  ejeId?: number;
  cantidad: number;
}

const POR_REPASAR = `
  SELECT f.pregunta_id::text AS "preguntaId", p.version, f.prueba_id AS "pruebaId", v.eje_id AS "ejeId",
         row_number() OVER (ORDER BY f.fecha DESC, f.pregunta_id DESC) AS posicion
    FROM app.v_preguntas_falladas f
    JOIN contenido.pregunta p ON p.id = f.pregunta_id
    JOIN contenido.estado_pregunta ep ON ep.id = p.estado_pregunta_id AND ep.visible_estudiante
    JOIN contenido.pregunta_version v ON v.pregunta_id = p.id AND v.version = p.version
   WHERE f.estudiante_id = $1`;

const DENTRO_DEL_LIMITE = '($2::int IS NULL OR f.posicion <= $2)';
const DEL_ALCANCE = `f."pruebaId" = $3 AND ($4::int IS NULL OR f."ejeId" = $4)`;

const consultasRepaso = {
  async contarTotal(estudianteId: string, tx: Ejecutor): Promise<number> {
    const { rows } = await tx.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM (${POR_REPASAR}) f`,
      [estudianteId],
    );
    return rows[0]?.total ?? 0;
  },
  async listar(
    estudianteId: string,
    limite: number | null,
    tx: Ejecutor,
  ): Promise<FilaPorRepasar[]> {
    const { rows } = await tx.query<FilaPorRepasar>(
      `SELECT pr.id AS "pruebaId", pr.codigo AS "pruebaCodigo", pr.nombre AS "pruebaNombre",
              ej.id AS "ejeId", ej.nombre AS "ejeNombre", COUNT(*)::int AS preguntas
         FROM (${POR_REPASAR}) f
         JOIN contenido.prueba pr ON pr.id = f."pruebaId"
         JOIN contenido.eje_tematico ej ON ej.id = f."ejeId"
        WHERE ${DENTRO_DEL_LIMITE}
        GROUP BY pr.id, pr.codigo, pr.nombre, ej.id, ej.nombre, ej.orden
        ORDER BY pr.id, ej.orden`,
      [estudianteId, limite],
    );
    return rows;
  },
  async contarDelAlcance(filtro: FiltroRepaso, tx: Ejecutor): Promise<number> {
    const { rows } = await tx.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM (${POR_REPASAR}) f
        WHERE ${DENTRO_DEL_LIMITE} AND ${DEL_ALCANCE}`,
      [filtro.estudianteId, filtro.limite, filtro.pruebaId, filtro.ejeId ?? null],
    );
    return rows[0]?.total ?? 0;
  },
  /** La fallada más reciente que este repaso todavía no entrega. */
  async siguienteFallada(
    filtro: FiltroRepaso,
    entregadas: string[],
    tx: Ejecutor,
  ): Promise<PreguntaSeleccionada | null> {
    const { rows } = await tx.query<PreguntaSeleccionada>(
      `SELECT f."preguntaId", f.version FROM (${POR_REPASAR}) f
        WHERE ${DENTRO_DEL_LIMITE} AND ${DEL_ALCANCE} AND NOT f."preguntaId" = ANY($5::text[])
        ORDER BY f.posicion LIMIT 1`,
      [filtro.estudianteId, filtro.limite, filtro.pruebaId, filtro.ejeId ?? null, entregadas],
    );
    return rows[0] ?? null;
  },
  async leerEstructura(pruebaId: number, tx: Ejecutor): Promise<EstructuraRepaso | null> {
    const { rows } = await tx.query<EstructuraRepaso>(
      `SELECT s.id, s.cantidad_max AS "cantidadMax"
         FROM contenido.estructura_evaluacion s
         JOIN contenido.tipo_evaluacion t ON t.id = s.tipo_evaluacion_id
         JOIN contenido.prueba p ON p.id = s.prueba_id
        WHERE t.codigo = 'repaso' AND s.prueba_id = $1 AND s.activa AND p.activa`,
      [pruebaId],
    );
    return rows[0] ?? null;
  },
  async crear(datos: NuevoRepaso, tx: Ejecutor): Promise<string> {
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO app.evaluacion
          (estudiante_id, tipo_evaluacion_id, unica_por_anio_escolar, prueba_id, estructura_id,
           eje_id, anio_escolar, cantidad_preguntas, estado_evaluacion_id)
         SELECT $1, t.id, false, $2, $3, $4, 0, $5, ee.id
           FROM contenido.tipo_evaluacion t CROSS JOIN contenido.estado_evaluacion ee
          WHERE t.codigo = 'repaso' AND ee.codigo = 'en_curso' RETURNING id::text`,
      [datos.estudianteId, datos.pruebaId, datos.estructuraId, datos.ejeId ?? null, datos.cantidad],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('No se pudo crear el repaso.');
    return id;
  },
};

export function crearRepasoRepositorio() {
  return consultasRepaso;
}

export type RepasoRepositorio = ReturnType<typeof crearRepasoRepositorio>;
