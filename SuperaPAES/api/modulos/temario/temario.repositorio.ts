// Único lugar con SQL del módulo temario. Consultas siempre parametrizadas ($1, $2...).
// Tablas que pertenecen a este módulo (ningún otro módulo las escribe):
//   - contenido.area
//   - contenido.prueba
//   - contenido.prueba_tipo_pregunta
//   - contenido.eje_tematico
//   - contenido.contenido_tematico
//   - contenido.habilidad
//   - contenido.area_carrera_prueba (pruebas y electivo que sugiere cada área de carrera)
// Cada método recibe un Ejecutor opcional (tx) para sumarse a la transacción del servicio.
import type { Ejecutor } from '../../db/transaccion.js';

/** Área de especialidad de los docentes (contenido.area). */
export interface Area {
  id: number;
  nombre: string;
}

/** Una fila por contenido (o por prueba o eje sin contenidos), en el orden del temario. */
export interface FilaTemario {
  pruebaId: number;
  pruebaCodigo: string;
  pruebaNombre: string;
  ejeId: number | null;
  ejeNombre: string | null;
  contenidoId: number | null;
  contenidoNombre: string | null;
}

/** Habilidad de una prueba (contenido.habilidad). */
export interface FilaHabilidad {
  id: number;
  pruebaId: number;
  nombre: string;
}

export interface TemarioRepositorio {
  listarAreas(tx?: Ejecutor): Promise<Area[]>;
  alcancePracticaValido(datos: AlcancePractica, tx?: Ejecutor): Promise<boolean>;
  listarTemario(tx?: Ejecutor): Promise<FilaTemario[]>;
  listarHabilidades(tx?: Ejecutor): Promise<FilaHabilidad[]>;
}

export interface AlcancePractica {
  pruebaId: number;
  ejeId?: number;
  contenidoId?: number;
  habilidadId?: number;
  nivelEscolarId: number | null;
}

async function existe(tx: Ejecutor, sql: string, parametros: unknown[]): Promise<boolean> {
  const { rows } = await tx.query<{ valido: boolean }>(sql, parametros);
  return rows[0]?.valido ?? false;
}

function ejeValido(tx: Ejecutor, datos: AlcancePractica): Promise<boolean> {
  return existe(
    tx,
    `SELECT EXISTS(SELECT 1 FROM contenido.eje_tematico
      WHERE id=$1 AND prueba_id=$2 AND activo) AS valido`,
    [datos.ejeId, datos.pruebaId],
  );
}

function habilidadValida(tx: Ejecutor, datos: AlcancePractica): Promise<boolean> {
  return existe(
    tx,
    `SELECT EXISTS(SELECT 1 FROM contenido.habilidad
      WHERE id=$1 AND prueba_id=$2) AS valido`,
    [datos.habilidadId, datos.pruebaId],
  );
}

function contenidoValido(tx: Ejecutor, datos: AlcancePractica): Promise<boolean> {
  return existe(
    tx,
    `SELECT EXISTS(SELECT 1 FROM contenido.contenido_tematico c
      JOIN contenido.prueba p ON p.id=c.prueba_id
      LEFT JOIN contenido.nivel_escolar nc ON nc.id=c.nivel_escolar_id
      LEFT JOIN contenido.nivel_escolar ne ON ne.id=$3
      WHERE c.id=$1 AND c.prueba_id=$2 AND c.activo
        AND (p.codigo='CL' OR $3::smallint IS NULL OR nc.orden IS NULL OR nc.orden<=ne.orden)) AS valido`,
    [datos.contenidoId, datos.pruebaId, datos.nivelEscolarId],
  );
}

const TEMARIO = `
  SELECT p.id AS "pruebaId", p.codigo AS "pruebaCodigo", p.nombre AS "pruebaNombre",
         e.id AS "ejeId", e.nombre AS "ejeNombre", c.id AS "contenidoId", c.nombre AS "contenidoNombre"
    FROM contenido.prueba p
    LEFT JOIN contenido.eje_tematico e ON e.prueba_id = p.id
    LEFT JOIN contenido.contenido_tematico c ON c.eje_id = e.id
   ORDER BY p.id, e.orden, e.id, c.nombre, c.id`;

export function crearTemarioRepositorio(bd: Ejecutor): TemarioRepositorio {
  return {
    async listarAreas(tx = bd) {
      const { rows } = await tx.query<Area>(
        'SELECT id, nombre FROM contenido.area ORDER BY nombre',
      );
      return rows;
    },
    async alcancePracticaValido(datos, tx = bd) {
      if (datos.ejeId !== undefined) return ejeValido(tx, datos);
      if (datos.habilidadId !== undefined) return habilidadValida(tx, datos);
      if (datos.contenidoId !== undefined) return contenidoValido(tx, datos);
      return true;
    },

    async listarTemario(tx = bd) {
      const { rows } = await tx.query<FilaTemario>(TEMARIO);
      return rows;
    },

    async listarHabilidades(tx = bd) {
      const { rows } = await tx.query<FilaHabilidad>(
        'SELECT id, prueba_id AS "pruebaId", nombre FROM contenido.habilidad ORDER BY prueba_id, codigo, id',
      );
      return rows;
    },
  };
}
