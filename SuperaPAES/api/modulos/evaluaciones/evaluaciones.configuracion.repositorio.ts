// SQL de la configuración de evaluaciones (C08, HU-63.1, CU-31): las estructuras con su reparto y las tablas de
// conversión del DEMRE. Consultas parametrizadas; cada escritura recibe el Ejecutor de la transacción del servicio.
import type { Ejecutor } from '../../db/transaccion.js';

export interface FilaReparto {
  id: number;
  estructuraId: number;
  nombre: string;
  cantidad: number;
  noPuntuables: number;
}

export interface FilaEstructura {
  id: number;
  tipo: string;
  tipoNombre: string;
  pruebaId: number;
  cantidadMin: number;
  cantidadMax: number;
  noPuntuables: number;
  duracionMin: number | null;
  textos: number | null;
  usosGratisMes: number;
}

export interface FilaTabla {
  id: number;
  anioAdmision: number;
  proceso: string;
  electivoId: number | null;
  electivo: string | null;
  publicadaEn: string;
  filas: number;
  vigente: boolean;
}

export interface Opcion {
  id: number;
  nombre: string;
}

export interface CambioEstructura {
  cantidadMin: number;
  cantidadMax: number;
  noPuntuables: number;
  duracionMin: number | null;
  textos: number | null;
  usosGratisMes: number;
}

export interface NuevaTabla {
  pruebaId: number;
  procesoId: number;
  anioAdmision: number;
  electivoAreaId: number | null;
  publicadaEn: string;
  cargadaPor: string;
}

const CAMPOS_ESTRUCTURA = `
  s.id, t.codigo AS tipo, t.nombre AS "tipoNombre", s.prueba_id AS "pruebaId",
  s.cantidad_min AS "cantidadMin", s.cantidad_max AS "cantidadMax", s.no_puntuables AS "noPuntuables",
  s.duracion_min AS "duracionMin", s.textos, s.usos_gratis_mes AS "usosGratisMes"`;

const CAMPOS_REPARTO = `
  d.id, d.estructura_id AS "estructuraId", COALESCE(e.nombre, h.nombre, 'Módulo electivo') AS nombre,
  d.cantidad, d.no_puntuables AS "noPuntuables"
    FROM contenido.estructura_detalle d
    LEFT JOIN contenido.eje_tematico e ON e.id = d.eje_id
    LEFT JOIN contenido.habilidad h ON h.id = d.habilidad_id`;

/** Vigente: la misma regla con que el ensayo elige su tabla (RN-23), por electivo. */
const TABLAS = `
  SELECT t.id, t.anio_admision AS "anioAdmision", pa.nombre AS proceso, t.electivo_area_id AS "electivoId",
         a.nombre AS electivo, to_char(t.publicada_en, 'YYYY-MM-DD') AS "publicadaEn",
         (SELECT count(*)::int FROM contenido.tabla_conversion_fila f WHERE f.tabla_conversion_id = t.id) AS filas,
         row_number() OVER (
           PARTITION BY t.electivo_area_id ORDER BY t.publicada_en DESC, t.anio_admision DESC, t.id DESC
         ) = 1 AS vigente
    FROM contenido.tabla_conversion t
    JOIN contenido.proceso_admision pa ON pa.id = t.proceso_admision_id
    LEFT JOIN contenido.area a ON a.id = t.electivo_area_id
   WHERE t.prueba_id = $1
   ORDER BY t.publicada_en DESC, a.nombre NULLS FIRST, t.id DESC`;

function lecturas(bd: Ejecutor) {
  return {
    async estructuras(pruebaId: number): Promise<FilaEstructura[]> {
      const { rows } = await bd.query<FilaEstructura>(
        `SELECT ${CAMPOS_ESTRUCTURA}
           FROM contenido.estructura_evaluacion s
           JOIN contenido.tipo_evaluacion t ON t.id = s.tipo_evaluacion_id
          WHERE s.prueba_id = $1
          ORDER BY array_position(ARRAY['practica', 'repaso', 'diagnostico', 'mini_ensayo', 'ensayo'], t.codigo::text)`,
        [pruebaId],
      );
      return rows;
    },

    async repartos(pruebaId: number): Promise<FilaReparto[]> {
      const { rows } = await bd.query<FilaReparto>(
        `SELECT ${CAMPOS_REPARTO} WHERE d.prueba_id = $1
          ORDER BY COALESCE(e.orden, h.id, 32767), d.id`,
        [pruebaId],
      );
      return rows;
    },

    async tablas(pruebaId: number, tx: Ejecutor = bd): Promise<FilaTabla[]> {
      const { rows } = await tx.query<FilaTabla>(TABLAS, [pruebaId]);
      return rows;
    },

    /** Los electivos de la prueba, según la misma regla de la base: solo Ciencias los tiene. */
    async electivos(pruebaId: number, tx: Ejecutor = bd): Promise<Opcion[]> {
      const { rows } = await tx.query<Opcion>(
        `SELECT a.id, a.nombre FROM contenido.area a
           JOIN contenido.prueba p ON p.id = $1 AND p.codigo = 'CIE'
          WHERE contenido.electivo_valido($1, a.id) ORDER BY a.nombre`,
        [pruebaId],
      );
      return rows;
    },

    async procesos(): Promise<Opcion[]> {
      const { rows } = await bd.query<Opcion>(
        'SELECT id, nombre FROM contenido.proceso_admision ORDER BY id',
      );
      return rows;
    },
  };
}

function escriturasEstructura(bd: Ejecutor) {
  return {
    async bloquearEstructura(id: number, tx: Ejecutor = bd): Promise<FilaEstructura | null> {
      const { rows } = await tx.query<FilaEstructura>(
        `SELECT ${CAMPOS_ESTRUCTURA}
           FROM contenido.estructura_evaluacion s
           JOIN contenido.tipo_evaluacion t ON t.id = s.tipo_evaluacion_id
          WHERE s.id = $1 FOR UPDATE OF s`,
        [id],
      );
      return rows[0] ?? null;
    },

    async repartoDe(estructuraId: number, tx: Ejecutor = bd): Promise<FilaReparto[]> {
      const { rows } = await tx.query<FilaReparto>(
        `SELECT ${CAMPOS_REPARTO} WHERE d.estructura_id = $1 ORDER BY COALESCE(e.orden, h.id, 32767), d.id`,
        [estructuraId],
      );
      return rows;
    },

    async actualizarEstructura(id: number, datos: CambioEstructura, tx: Ejecutor): Promise<void> {
      await tx.query(
        `UPDATE contenido.estructura_evaluacion
            SET cantidad_min = $2, cantidad_max = $3, no_puntuables = $4, duracion_min = $5,
                textos = $6, usos_gratis_mes = $7
          WHERE id = $1`,
        [
          id,
          datos.cantidadMin,
          datos.cantidadMax,
          datos.noPuntuables,
          datos.duracionMin,
          datos.textos,
          datos.usosGratisMes,
        ],
      );
    },

    async actualizarReparto(id: number, cantidad: number, tx: Ejecutor): Promise<void> {
      await tx.query('UPDATE contenido.estructura_detalle SET cantidad = $2 WHERE id = $1', [
        id,
        cantidad,
      ]);
    },
  };
}

function escriturasTabla() {
  return {
    async existeTabla(datos: NuevaTabla, tx: Ejecutor): Promise<boolean> {
      const { rowCount } = await tx.query(
        `SELECT 1 FROM contenido.tabla_conversion
          WHERE prueba_id = $1 AND proceso_admision_id = $2 AND anio_admision = $3
            AND electivo_area_id IS NOT DISTINCT FROM $4::smallint`,
        [datos.pruebaId, datos.procesoId, datos.anioAdmision, datos.electivoAreaId],
      );
      return (rowCount ?? 0) > 0;
    },

    async crearTabla(
      datos: NuevaTabla,
      filas: readonly { correctas: number; puntaje: number }[],
      tx: Ejecutor,
    ): Promise<number> {
      const { rows } = await tx.query<{ id: number }>(
        `INSERT INTO contenido.tabla_conversion
           (prueba_id, proceso_admision_id, anio_admision, electivo_area_id, publicada_en, cargada_por)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          datos.pruebaId,
          datos.procesoId,
          datos.anioAdmision,
          datos.electivoAreaId,
          datos.publicadaEn,
          datos.cargadaPor,
        ],
      );
      const id = rows[0]!.id;
      await tx.query(
        `INSERT INTO contenido.tabla_conversion_fila (tabla_conversion_id, correctas, puntaje)
         SELECT $1, f.correctas, f.puntaje
           FROM unnest($2::smallint[], $3::smallint[]) AS f(correctas, puntaje)`,
        [id, filas.map((f) => f.correctas), filas.map((f) => f.puntaje)],
      );
      return id;
    },
  };
}

export function crearConfiguracionRepositorio(bd: Ejecutor) {
  return { ...lecturas(bd), ...escriturasEstructura(bd), ...escriturasTabla() };
}

export type ConfiguracionRepositorio = ReturnType<typeof crearConfiguracionRepositorio>;
