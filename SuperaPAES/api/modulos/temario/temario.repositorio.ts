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
  /** Cuántas alternativas lleva cada pregunta de la prueba (RN-08). */
  opcionesMin: number;
  opcionesMax: number;
  /** La prueba se organiza en textos de lectura: cada pregunta va con el suyo (RN-08). */
  requiereTexto: boolean;
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

/** Tipo de pregunta que admite una prueba (contenido.prueba_tipo_pregunta), por su código. */
export interface FilaTipoPregunta {
  pruebaId: number;
  codigo: string;
  nombre: string;
}

/** Curso que el estudiante elige en su perfil (contenido.nivel_escolar, de 1° a 4° medio y egresado). */
export interface CursoPerfil {
  codigo: string;
  nombre: string;
}

/** Prueba activa con los electivos que admite: solo Ciencias tiene (Biología, Física y Química). */
export interface PruebaPerfil {
  id: number;
  codigo: string;
  nombre: string;
  electivos: Area[];
}

/** Área de carrera activa con las pruebas y el electivo que sugiere (RN-25). */
export interface AreaCarreraPerfil {
  id: number;
  codigo: string;
  nombre: string;
  pruebasSugeridas: number[];
  electivoSugeridoId: number | null;
}

export interface TemarioRepositorio {
  listarAreas(tx?: Ejecutor): Promise<Area[]>;
  alcancePracticaValido(datos: AlcancePractica, tx?: Ejecutor): Promise<boolean>;
  listarTemario(tx?: Ejecutor): Promise<FilaTemario[]>;
  listarHabilidades(tx?: Ejecutor): Promise<FilaHabilidad[]>;
  listarTiposPregunta(tx?: Ejecutor): Promise<FilaTipoPregunta[]>;
  listarCursosPerfil(tx?: Ejecutor): Promise<CursoPerfil[]>;
  listarPruebasPerfil(tx?: Ejecutor): Promise<PruebaPerfil[]>;
  listarAreasCarrera(tx?: Ejecutor): Promise<AreaCarreraPerfil[]>;
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
         p.opciones_min AS "opcionesMin", p.opciones_max AS "opcionesMax",
         p.textos IS NOT NULL AS "requiereTexto",
         e.id AS "ejeId", e.nombre AS "ejeNombre", c.id AS "contenidoId", c.nombre AS "contenidoNombre"
    FROM contenido.prueba p
    LEFT JOIN contenido.eje_tematico e ON e.prueba_id = p.id
    LEFT JOIN contenido.contenido_tematico c ON c.eje_id = e.id
   ORDER BY p.id, e.orden, e.id, c.nombre, c.id`;

/** contenido.tipo_pregunta es una lista de opciones sin módulo propio; solo los tipos activos. */
const TIPOS_PREGUNTA = `
  SELECT ptp.prueba_id AS "pruebaId", t.codigo, t.nombre
    FROM contenido.prueba_tipo_pregunta ptp
    JOIN contenido.tipo_pregunta t ON t.id = ptp.tipo_pregunta_id
   WHERE t.activo
   ORDER BY ptp.prueba_id, t.id`;

/** De 1° a 4° medio (0 a 3 años para egresar) y egresado; 7° y 8° básico no se ofrecen (A08). */
const CURSOS_PERFIL = `
  SELECT codigo, nombre FROM contenido.nivel_escolar
   WHERE anios_para_egreso BETWEEN 0 AND 3 OR codigo = 'EG'
   ORDER BY orden`;

/** El electivo es un área con contenidos en Ciencias, igual que contenido.electivo_valido. */
const PRUEBAS_PERFIL = `
  SELECT p.id, p.codigo, p.nombre,
         COALESCE((SELECT json_agg(json_build_object('id', a.id, 'nombre', a.nombre) ORDER BY a.nombre)
                     FROM contenido.area a
                    WHERE p.codigo = 'CIE'
                      AND EXISTS (SELECT 1 FROM contenido.contenido_tematico c
                                   WHERE c.prueba_id = p.id AND c.area_id = a.id)), '[]') AS electivos
    FROM contenido.prueba p
   WHERE p.activa
   ORDER BY p.id`;

/** Solo sugiere pruebas activas. contenido.area_carrera es una lista de opciones sin módulo propio. */
const AREAS_CARRERA = `
  SELECT ac.id, ac.codigo, ac.nombre, ac.electivo_area_id AS "electivoSugeridoId",
         COALESCE(array_agg(p.id ORDER BY p.id) FILTER (WHERE p.id IS NOT NULL), '{}') AS "pruebasSugeridas"
    FROM contenido.area_carrera ac
    LEFT JOIN contenido.area_carrera_prueba acp ON acp.area_carrera_id = ac.id
    LEFT JOIN contenido.prueba p ON p.id = acp.prueba_id AND p.activa
   WHERE ac.activo
   GROUP BY ac.id
   ORDER BY ac.orden, ac.id`;

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

    async listarTiposPregunta(tx = bd) {
      const { rows } = await tx.query<FilaTipoPregunta>(TIPOS_PREGUNTA);
      return rows;
    },

    async listarCursosPerfil(tx = bd) {
      const { rows } = await tx.query<CursoPerfil>(CURSOS_PERFIL);
      return rows;
    },

    async listarPruebasPerfil(tx = bd) {
      const { rows } = await tx.query<PruebaPerfil>(PRUEBAS_PERFIL);
      return rows;
    },

    async listarAreasCarrera(tx = bd) {
      const { rows } = await tx.query<AreaCarreraPerfil>(AREAS_CARRERA);
      return rows;
    },
  };
}
