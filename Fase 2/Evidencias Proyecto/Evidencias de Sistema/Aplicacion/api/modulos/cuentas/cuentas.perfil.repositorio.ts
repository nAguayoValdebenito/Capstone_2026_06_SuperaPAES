// SQL del perfil del estudiante (HU-29.1, RF-A04, RN-24, RN-25, CU-05): año de egreso, pruebas con su
// electivo y la prueba a reforzar (app.estudiante_prueba) e intereses de carrera
// (app.estudiante_interes_carrera). Las pruebas, los cursos y las áreas de carrera solo se leen.
// La fecha de Chile sale del instante del reloj del servicio, para poder probar el cambio de marzo.
import type { Ejecutor } from '../../db/transaccion.js';

/** Fecha de hoy en Chile a partir del instante $2. */
const HOY_CHILE = "($2::timestamptz AT TIME ZONE 'America/Santiago')::date";
/** Año escolar en que se confirmó el curso por última vez. */
const ANIO_CONFIRMACION =
  "app.anio_escolar((e.curso_confirmado_en AT TIME ZONE 'America/Santiago')::date)";

/** El perfil tal como está guardado, con el curso de hoy ya calculado por la base. */
export interface FilaPerfil {
  anioEgreso: number | null;
  cursoCodigo: string | null;
  cursoNombre: string | null;
  pruebas: number[];
  electivoId: number | null;
  pruebaReforzarId: number | null;
  areasCarrera: number[];
  /** Nunca confirmó, o confirmó en un año escolar anterior cuando todavía no egresaba. */
  cursoPorConfirmar: boolean;
}

/** Lo que se guarda: el año de egreso ya calculado a partir del curso. */
export interface PerfilAGuardar {
  anioEgreso: number;
  pruebas: readonly number[];
  electivoId: number | null;
  pruebaReforzarId: number | null;
  areasCarrera: readonly number[];
}

/** Año escolar de hoy (cambia en marzo) y los años que le faltan para egresar a quien está en el curso. */
export interface AnioEscolarYCurso {
  anioEscolar: number;
  aniosParaEgreso: number | null;
}

const PERFIL = `
  SELECT e.anio_egreso AS "anioEgreso", ne.codigo AS "cursoCodigo", ne.nombre AS "cursoNombre",
         COALESCE((SELECT array_agg(ep.prueba_id ORDER BY ep.prueba_id) FROM app.estudiante_prueba ep
                    WHERE ep.estudiante_id = e.id), '{}') AS pruebas,
         (SELECT ep.electivo_area_id FROM app.estudiante_prueba ep
           WHERE ep.estudiante_id = e.id AND ep.electivo_area_id IS NOT NULL LIMIT 1) AS "electivoId",
         (SELECT ep.prueba_id FROM app.estudiante_prueba ep
           WHERE ep.estudiante_id = e.id AND ep.es_principal) AS "pruebaReforzarId",
         COALESCE((SELECT array_agg(i.area_carrera_id ORDER BY i.area_carrera_id)
                     FROM app.estudiante_interes_carrera i WHERE i.estudiante_id = e.id), '{}') AS "areasCarrera",
         (e.anio_egreso IS NOT NULL AND (e.curso_confirmado_en IS NULL
            OR (${ANIO_CONFIRMACION} < app.anio_escolar(${HOY_CHILE})
                AND e.anio_egreso >= ${ANIO_CONFIRMACION}))) AS "cursoPorConfirmar"
    FROM app.estudiante e
    LEFT JOIN contenido.nivel_escolar ne ON ne.id = app.nivel_escolar_en(e.anio_egreso, ${HOY_CHILE})
   WHERE e.id = $1 AND e.eliminado_en IS NULL`;

/**
 * Reemplaza las pruebas; el electivo va en la fila de Ciencias y la prueba a reforzar se marca. Sin
 * prueba a reforzar ($3 nulo), IS NOT DISTINCT FROM da false, no NULL.
 */
const INSERTAR_PRUEBAS = `
  INSERT INTO app.estudiante_prueba (estudiante_id, prueba_id, es_principal, electivo_area_id)
  SELECT $1, p.id, p.id IS NOT DISTINCT FROM $3::smallint, CASE WHEN p.codigo = 'CIE' THEN $4::smallint END
    FROM contenido.prueba p WHERE p.id = ANY($2::smallint[])`;

async function anioEscolarYCurso(
  tx: Ejecutor,
  curso: string,
  instante: Date,
): Promise<AnioEscolarYCurso> {
  const { rows } = await tx.query<AnioEscolarYCurso>(
    `SELECT app.anio_escolar(${HOY_CHILE}) AS "anioEscolar",
            (SELECT anios_para_egreso FROM contenido.nivel_escolar WHERE codigo = $1) AS "aniosParaEgreso"`,
    [curso, instante],
  );
  const fila = rows[0];
  if (!fila) throw new Error('La base no calculó el año escolar.');
  return fila;
}

/**
 * Reemplaza las pruebas y los intereses. Los intereses que siguen marcados conservan su fecha, y se
 * borran antes de agregar para que el tope de tres (tg_interes_carrera) cuente la lista nueva.
 */
async function guardarElecciones(
  tx: Ejecutor,
  estudianteId: string,
  perfil: PerfilAGuardar,
  instante: Date,
): Promise<void> {
  const { pruebas, pruebaReforzarId, electivoId, areasCarrera } = perfil;
  await tx.query('DELETE FROM app.estudiante_prueba WHERE estudiante_id = $1', [estudianteId]);
  await tx.query(INSERTAR_PRUEBAS, [estudianteId, pruebas, pruebaReforzarId, electivoId]);
  await tx.query(
    `DELETE FROM app.estudiante_interes_carrera
      WHERE estudiante_id = $1 AND NOT (area_carrera_id = ANY($2::smallint[]))`,
    [estudianteId, areasCarrera],
  );
  await tx.query(
    `INSERT INTO app.estudiante_interes_carrera (estudiante_id, area_carrera_id, creado_en)
     SELECT $1, unnest($2::smallint[]), $3 ON CONFLICT DO NOTHING`,
    [estudianteId, areasCarrera, instante],
  );
}

/** Bloquea la fila del estudiante (el primer bloqueo del perfil) y dice si tiene perfil completo. */
async function bloquearEstudiante(
  estudianteId: string,
  tx: Ejecutor,
): Promise<{ completo: boolean } | null> {
  const { rows } = await tx.query<{ completo: boolean }>(
    `SELECT (e.anio_egreso IS NOT NULL
             AND EXISTS (SELECT 1 FROM app.estudiante_prueba ep WHERE ep.estudiante_id = e.id)) AS completo
       FROM app.estudiante e WHERE e.id = $1 AND e.eliminado_en IS NULL FOR UPDATE`,
    [estudianteId],
  );
  return rows[0] ?? null;
}

export function crearPerfilRepositorio(bd: Ejecutor) {
  return {
    async leerPerfil(estudianteId: string, instante: Date, tx?: Ejecutor) {
      const { rows } = await (tx ?? bd).query<FilaPerfil>(PERFIL, [estudianteId, instante]);
      return rows[0] ?? null;
    },

    anioEscolarYCurso: (curso: string, instante: Date, tx?: Ejecutor) =>
      anioEscolarYCurso(tx ?? bd, curso, instante),

    /** Código de cada prueba activa de la lista; las que no existen o no están activas no vienen. */
    async pruebasActivas(ids: readonly number[], tx?: Ejecutor) {
      const { rows } = await (tx ?? bd).query<{ id: number; codigo: string }>(
        'SELECT id, codigo FROM contenido.prueba WHERE id = ANY($1::smallint[]) AND activa',
        [ids],
      );
      return rows;
    },

    /** RN-35: el electivo de Ciencias es un área con contenidos en esa prueba. */
    async electivoValido(pruebaId: number, areaId: number, tx?: Ejecutor) {
      const { rows } = await (tx ?? bd).query<{ valido: boolean }>(
        'SELECT contenido.electivo_valido($1::smallint, $2::smallint) AS valido',
        [pruebaId, areaId],
      );
      return rows[0]?.valido ?? false;
    },

    async cuantasAreasCarreraActivas(ids: readonly number[], tx?: Ejecutor) {
      const { rows } = await (tx ?? bd).query<{ total: number }>(
        'SELECT COUNT(*)::int AS total FROM contenido.area_carrera WHERE id = ANY($1::smallint[]) AND activo',
        [ids],
      );
      return rows[0]?.total ?? 0;
    },

    bloquearEstudiante,

    async guardarCurso(estudianteId: string, anioEgreso: number, instante: Date, tx: Ejecutor) {
      await tx.query(
        'UPDATE app.estudiante SET anio_egreso = $2, curso_confirmado_en = $3 WHERE id = $1',
        [estudianteId, anioEgreso, instante],
      );
    },

    guardarElecciones: (
      estudianteId: string,
      perfil: PerfilAGuardar,
      instante: Date,
      tx: Ejecutor,
    ) => guardarElecciones(tx, estudianteId, perfil, instante),
  };
}

export type PerfilRepositorio = ReturnType<typeof crearPerfilRepositorio>;
