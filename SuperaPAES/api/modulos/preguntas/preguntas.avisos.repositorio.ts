// SQL de los avisos de error que envían los estudiantes (HU-50, RF-C08, CU-26, CU-26a, C13): la bandeja
// agrupada por pregunta, el cierre de un aviso como resuelto o descartado y la anulación de la pregunta
// con app.anular_pregunta. app.reporte_pregunta y esa función son de este módulo. Los estados y motivos se leen por su código (listas de opciones). La bandeja nunca entrega
// datos del estudiante. Consultas siempre parametrizadas; cada método acepta la transacción en curso.
import type { Ejecutor } from '../../db/transaccion.js';
import type { Opcion } from './preguntas.repositorio.js';

/** Un aviso, tal como lo ve el administrador. Las fechas llegan como texto desde json_agg. */
export interface FilaAviso {
  id: string;
  /** Versión de la pregunta que vio el estudiante. */
  version: number;
  motivo: Opcion;
  comentario: string;
  estado: Opcion;
  creadoEn: string;
  resueltoEn: string | null;
  /** Nombre del administrador que lo cerró. */
  resueltoPor: string | null;
}

/** Una pregunta de la bandeja con sus avisos que cumplen el filtro. */
export interface FilaGrupoAvisos {
  preguntaId: string;
  versionActual: number;
  estado: Opcion;
  contenidoId: number;
  resumen: string;
  /** Avisos pendientes de la pregunta, cumplan o no el filtro. */
  pendientes: number;
  avisos: FilaAviso[];
}

/** Filtros ya resueltos por el servicio: null es «todos». */
export interface ConsultaAvisos {
  estado: string | null;
  motivo: string | null;
  limite: number;
  desde: number;
}

/** El estado de un aviso, reservado hasta el fin de la transacción. */
export interface AvisoReservado {
  estado: Opcion;
  final: boolean;
}

export interface AvisosRepositorio {
  listarAvisos(consulta: ConsultaAvisos): Promise<{ filas: FilaGrupoAvisos[]; total: number }>;
  motivosDeAviso(): Promise<Opcion[]>;
  /** El aviso reservado (FOR UPDATE); null si no existe. */
  reservarAviso(id: string, tx: Ejecutor): Promise<AvisoReservado | null>;
  /** Cierra el aviso con el estado (por su código), quién lo cerró y la fecha; devuelve el aviso. */
  cerrarAviso(id: string, [estado, usuarioId]: [string, string], tx: Ejecutor): Promise<FilaAviso>;
  /** La etapa de la pregunta, reservada (FOR UPDATE); null si no existe. */
  reservarPregunta(id: string, tx: Ejecutor): Promise<Opcion | null>;
  /**
   * Llama a app.anular_pregunta a nombre del administrador (el historial lo registra) y devuelve cuántas
   * evaluaciones cerradas se recalcularon y la etapa en que quedó la pregunta.
   */
  anularPregunta(id: string, usuarioId: string, tx: Ejecutor): Promise<PreguntaAnuladaFila>;
  /** Cierra como resueltos los avisos pendientes de la pregunta; devuelve sus ids. */
  resolverPendientes(preguntaId: string, usuarioId: string, tx: Ejecutor): Promise<string[]>;
}

export interface PreguntaAnuladaFila {
  recalculadas: number;
  estado: Opcion;
}

/** Un aviso como JSON, a partir de la fila r de app.reporte_pregunta. */
const AVISO_JSON = `json_build_object(
    'id', r.id::text, 'version', r.version_pregunta,
    'motivo', json_build_object('codigo', mr.codigo, 'nombre', mr.nombre),
    'comentario', r.comentario,
    'estado', json_build_object('codigo', er.codigo, 'nombre', er.nombre),
    'creadoEn', r.creado_en, 'resueltoEn', r.resuelto_en, 'resueltoPor', u.nombre)`;

const UNIONES_AVISO = `
  JOIN contenido.motivo_reporte mr ON mr.id = r.motivo_reporte_id
  JOIN contenido.estado_reporte er ON er.id = r.estado_reporte_id
  LEFT JOIN contenido.usuario_interno u ON u.id = r.resuelto_por`;

// Se pagina por pregunta, de la que tiene el aviso más reciente a la más antigua.
const LISTAR = `
  WITH filtrados AS (
    SELECT r.id, r.pregunta_id, r.creado_en, ${AVISO_JSON} AS aviso
      FROM app.reporte_pregunta r ${UNIONES_AVISO}
     WHERE ($1::text IS NULL OR er.codigo = $1) AND ($2::text IS NULL OR mr.codigo = $2)
  ), grupos AS (
    SELECT pregunta_id, max(creado_en) AS ultimo, count(*) OVER ()::int AS total
      FROM filtrados GROUP BY pregunta_id
     ORDER BY ultimo DESC, pregunta_id DESC LIMIT $3 OFFSET $4
  )
  SELECT p.id::text AS "preguntaId", p.version AS "versionActual",
         json_build_object('codigo', ep.codigo, 'nombre', ep.nombre) AS estado,
         p.contenido_id AS "contenidoId", left(p.enunciado, 160) AS resumen,
         (SELECT count(*)::int FROM app.reporte_pregunta rp
            JOIN contenido.estado_reporte e ON e.id = rp.estado_reporte_id
           WHERE rp.pregunta_id = p.id AND NOT e.es_final) AS pendientes,
         (SELECT json_agg(f.aviso ORDER BY f.creado_en DESC, f.id DESC)
            FROM filtrados f WHERE f.pregunta_id = p.id) AS avisos,
         g.total
    FROM grupos g
    JOIN contenido.pregunta p ON p.id = g.pregunta_id
    JOIN contenido.estado_pregunta ep ON ep.id = p.estado_pregunta_id
   ORDER BY g.ultimo DESC, p.id DESC`;

const MOTIVOS = 'SELECT codigo, nombre FROM contenido.motivo_reporte ORDER BY id';

const RESERVAR = `
  SELECT json_build_object('codigo', er.codigo, 'nombre', er.nombre) AS estado, er.es_final AS final
    FROM app.reporte_pregunta r
    JOIN contenido.estado_reporte er ON er.id = r.estado_reporte_id
   WHERE r.id = $1
     FOR UPDATE OF r`;

const CERRAR = `
  UPDATE app.reporte_pregunta r
     SET estado_reporte_id = e.id, resuelto_por = $3, resuelto_en = now()
    FROM contenido.estado_reporte e
   WHERE r.id = $1 AND e.codigo = $2 AND e.es_final`;

const RESERVAR_PREGUNTA = `
  SELECT e.codigo, e.nombre
    FROM contenido.pregunta p
    JOIN contenido.estado_pregunta e ON e.id = p.estado_pregunta_id
   WHERE p.id = $1
     FOR UPDATE OF p`;

const ANULAR = 'SELECT app.anular_pregunta($1) AS recalculadas';

const RESOLVER_PENDIENTES = `
  UPDATE app.reporte_pregunta r
     SET estado_reporte_id = (SELECT id FROM contenido.estado_reporte WHERE codigo = 'resuelto'),
         resuelto_por = $2, resuelto_en = now()
    FROM contenido.estado_reporte e
   WHERE e.id = r.estado_reporte_id AND NOT e.es_final AND r.pregunta_id = $1
  RETURNING r.id::text AS id`;

const OBTENER = `SELECT ${AVISO_JSON} AS aviso FROM app.reporte_pregunta r ${UNIONES_AVISO} WHERE r.id = $1`;

export function crearAvisosRepositorio(bd: Ejecutor): AvisosRepositorio {
  return {
    async listarAvisos({ estado, motivo, limite, desde }) {
      const { rows } = await bd.query<FilaGrupoAvisos & { total: number }>(LISTAR, [
        estado,
        motivo,
        limite,
        desde,
      ]);
      const total = rows[0]?.total ?? 0;
      return { filas: rows.map(({ total: _total, ...fila }) => fila), total };
    },

    async motivosDeAviso() {
      return (await bd.query<Opcion>(MOTIVOS)).rows;
    },

    async reservarAviso(id, tx) {
      const { rows } = await tx.query<AvisoReservado>(RESERVAR, [id]);
      return rows[0] ?? null;
    },

    async cerrarAviso(id, [estado, usuarioId], tx) {
      const { rowCount } = await tx.query(CERRAR, [id, estado, usuarioId]);
      if (rowCount !== 1) throw new Error('El aviso no se cerró.');
      const { rows } = await tx.query<{ aviso: FilaAviso }>(OBTENER, [id]);
      const fila = rows[0];
      if (!fila) throw new Error('El aviso cerrado no se encontró.');
      return fila.aviso;
    },

    async reservarPregunta(id, tx) {
      const { rows } = await tx.query<Opcion>(RESERVAR_PREGUNTA, [id]);
      return rows[0] ?? null;
    },

    async anularPregunta(id, usuarioId, tx) {
      await tx.query("SELECT set_config('supera.usuario_id', $1, true)", [usuarioId]);
      const { rows } = await tx.query<{ recalculadas: number }>(ANULAR, [id]);
      // Otra sentencia: así ve la etapa en que la dejó la función.
      const estado = (await tx.query<Opcion>(RESERVAR_PREGUNTA, [id])).rows[0];
      if (!rows[0] || !estado) throw new Error('La pregunta no se anuló.');
      return { recalculadas: rows[0].recalculadas, estado };
    },

    async resolverPendientes(preguntaId, usuarioId, tx) {
      const { rows } = await tx.query<{ id: string }>(RESOLVER_PENDIENTES, [preguntaId, usuarioId]);
      return rows.map((fila) => fila.id).sort((a, b) => Number(a) - Number(b));
    },
  };
}
