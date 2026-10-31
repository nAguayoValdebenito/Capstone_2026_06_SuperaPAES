// SQL de los textos de lectura (contenido.texto_estimulo, HU-12.2). Consultas siempre parametrizadas.
// Lee por su código la lista contenido.tipo_texto y, para saber si un texto se puede editar, las etapas
// de las preguntas que lo usan (contenido.pregunta es de este mismo módulo).
import type { Ejecutor } from '../../db/transaccion.js';
import type { Opcion } from './preguntas.repositorio.js';
import type { DatosTexto } from './preguntas.validadores.js';

/** Largo del comienzo del contenido que se muestra en la lista de textos. */
const LARGO_RESUMEN = 160;

/** Texto en la lista: con cuántas preguntas lo usan. */
export interface FilaListaTexto {
  id: string;
  tipoTexto: Opcion;
  titulo: string | null;
  resumen: string | null;
  imagenUrl: string | null;
  preguntas: number;
  creadoEn: Date;
}

export interface FilaTexto {
  id: string;
  tipoTexto: string;
  titulo: string | null;
  contenido: string | null;
  imagenUrl: string | null;
  preguntas: number;
  creadoEn: Date;
}

/** Etapa de una pregunta que usa el texto. */
export interface EtapaDeUso {
  nombre: string;
  editable: boolean;
}

export interface PreguntasTextosRepositorio {
  listar(
    consulta: { buscar: string | null; limite: number; desde: number },
    tx?: Ejecutor,
  ): Promise<{ filas: FilaListaTexto[]; total: number }>;
  obtener(id: string, tx?: Ejecutor): Promise<FilaTexto | null>;
  /** Devuelve el id del texto nuevo. */
  insertar(datos: DatosTexto, autorId: string, tx: Ejecutor): Promise<string>;
  actualizar(id: string, datos: DatosTexto, tx: Ejecutor): Promise<void>;
  /**
   * Etapas de las preguntas que usan el texto. Las reserva (FOR SHARE) hasta el fin de la transacción:
   * ninguna cambia de etapa mientras se edita el texto.
   */
  etapasQueLoUsan(id: string, tx?: Ejecutor): Promise<EtapaDeUso[]>;
  listarTipos(tx?: Ejecutor): Promise<Opcion[]>;
}

const USOS = `(SELECT count(*)::int FROM contenido.pregunta p WHERE p.texto_estimulo_id = t.id)`;

// position() busca el texto tal cual: % y _ no son comodines como en LIKE.
const LISTAR = `
  SELECT t.id::text AS id, json_build_object('codigo', tt.codigo, 'nombre', tt.nombre) AS "tipoTexto",
         t.titulo, left(t.contenido, ${String(LARGO_RESUMEN)}) AS resumen, t.imagen_url AS "imagenUrl",
         ${USOS} AS preguntas, t.creado_en AS "creadoEn", count(*) OVER ()::int AS total
    FROM contenido.texto_estimulo t
    JOIN contenido.tipo_texto tt ON tt.id = t.tipo_texto_id
   WHERE $1::text IS NULL OR position(lower($1) IN lower(coalesce(t.titulo, ''))) > 0
   ORDER BY t.creado_en DESC, t.id DESC
   LIMIT $2 OFFSET $3`;

const TOTAL = `
  SELECT count(*)::int AS total FROM contenido.texto_estimulo t
   WHERE $1::text IS NULL OR position(lower($1) IN lower(coalesce(t.titulo, ''))) > 0`;

const OBTENER = `
  SELECT t.id::text AS id, tt.codigo AS "tipoTexto", t.titulo, t.contenido, t.imagen_url AS "imagenUrl",
         ${USOS} AS preguntas, t.creado_en AS "creadoEn"
    FROM contenido.texto_estimulo t
    JOIN contenido.tipo_texto tt ON tt.id = t.tipo_texto_id
   WHERE t.id = $1`;

const INSERTAR = `
  INSERT INTO contenido.texto_estimulo (tipo_texto_id, titulo, contenido, imagen_url, creado_por, creado_en)
  VALUES ((SELECT id FROM contenido.tipo_texto WHERE codigo = $1), $2, $3, $4, $5, now())
  RETURNING id::text AS id`;

const ACTUALIZAR = `
  UPDATE contenido.texto_estimulo
     SET tipo_texto_id = (SELECT id FROM contenido.tipo_texto WHERE codigo = $2),
         titulo = $3, contenido = $4, imagen_url = $5
   WHERE id = $1`;

const ETAPAS = `
  SELECT ep.nombre, ep.editable
    FROM contenido.pregunta p
    JOIN contenido.estado_pregunta ep ON ep.id = p.estado_pregunta_id
   WHERE p.texto_estimulo_id = $1
     FOR SHARE OF p`;

const columnas = (datos: DatosTexto) => [
  datos.tipoTexto,
  datos.titulo,
  datos.contenido,
  datos.imagenUrl,
];

type FilaConTotal = FilaListaTexto & { total: number };

export function crearPreguntasTextosRepositorio(bd: Ejecutor): PreguntasTextosRepositorio {
  return {
    async listar({ buscar, limite, desde }, tx = bd) {
      const { rows } = await tx.query<FilaConTotal>(LISTAR, [buscar, limite, desde]);
      if (rows.length === 0 && desde > 0) {
        const conteo = await tx.query<{ total: number }>(TOTAL, [buscar]);
        return { filas: [], total: conteo.rows[0]?.total ?? 0 };
      }
      return { filas: rows.map(({ total: _total, ...fila }) => fila), total: rows[0]?.total ?? 0 };
    },

    async obtener(id, tx = bd) {
      const { rows } = await tx.query<FilaTexto>(OBTENER, [id]);
      return rows[0] ?? null;
    },

    async insertar(datos, autorId, tx) {
      const { rows } = await tx.query<{ id: string }>(INSERTAR, [...columnas(datos), autorId]);
      const id = rows[0]?.id;
      if (id === undefined) throw new Error('El texto no se guardó.');
      return id;
    },

    async actualizar(id, datos, tx) {
      await tx.query(ACTUALIZAR, [id, ...columnas(datos)]);
    },

    async etapasQueLoUsan(id, tx = bd) {
      const { rows } = await tx.query<EtapaDeUso>(ETAPAS, [id]);
      return rows;
    },

    async listarTipos(tx = bd) {
      const { rows } = await tx.query<Opcion>(
        'SELECT codigo, nombre FROM contenido.tipo_texto WHERE activo ORDER BY id',
      );
      return rows;
    },
  };
}
