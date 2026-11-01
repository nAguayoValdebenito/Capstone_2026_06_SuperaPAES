// SQL de los lotes de generación con IA: crear, consultar y los totales de los topes (HU-16.2, HU-16.3,
// RNF-03). Consultas parametrizadas; cada método recibe el Ejecutor de la transacción del servicio.
// Los días y los meses son los de Chile (America/Santiago), como el cupo diario (RN-02).
import type { Ejecutor } from '../../db/transaccion.js';
import type { DatosNuevoLote, EstadoLote } from './generador.tipos.js';

export interface FilaLote {
  id: string;
  contenidoId: number;
  solicitanteId: string;
  conTexto: boolean;
  cantidad: number;
  modelo: string;
  versionInstrucciones: string;
  tokensUsados: number | null;
  costoUsd: number | null;
  validas: number;
  descartadas: number;
  motivosDescarte: unknown;
  estado: EstadoLote;
  creadoEn: Date;
}

export const CAMPOS_DE_LOTE = `
  l.id::text AS id, l.contenido_id AS "contenidoId", l.solicitante_id::text AS "solicitanteId",
  l.con_texto AS "conTexto", l.cantidad, l.modelo, l.version_instrucciones AS "versionInstrucciones",
  l.tokens_usados AS "tokensUsados", l.costo_usd::float8 AS "costoUsd", l.validas, l.descartadas,
  l.motivos_descarte AS "motivosDescarte", e.codigo AS estado, l.creado_en AS "creadoEn"`;
export const LOTE_CON_ESTADO = `
  FROM contenido.lote_generacion l JOIN contenido.estado_lote e ON e.id = l.estado_lote_id`;

async function obtener(bd: Ejecutor, id: string): Promise<FilaLote | null> {
  const { rows } = await bd.query<FilaLote>(
    `SELECT ${CAMPOS_DE_LOTE} ${LOTE_CON_ESTADO} WHERE l.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/** Consultas de un lote o de la lista. */
function consultas(bd: Ejecutor) {
  return {
    obtener: (id: string, tx: Ejecutor = bd) => obtener(tx, id),

    /** El pedido idéntico que todavía está pendiente (misma persona, contenido, cantidad y texto). */
    async pendienteIgual(
      datos: Pick<DatosNuevoLote, 'contenidoId' | 'solicitanteId' | 'cantidad' | 'conTexto'>,
      tx: Ejecutor = bd,
    ): Promise<FilaLote | null> {
      const { rows } = await tx.query<FilaLote>(
        `SELECT ${CAMPOS_DE_LOTE} ${LOTE_CON_ESTADO}
          WHERE e.codigo = 'pendiente' AND l.solicitante_id = $1 AND l.contenido_id = $2
            AND l.cantidad = $3 AND l.con_texto = $4
          ORDER BY l.id LIMIT 1`,
        [datos.solicitanteId, datos.contenidoId, datos.cantidad, datos.conTexto],
      );
      return rows[0] ?? null;
    },

    async listar(
      limite: number,
      desplazamiento: number,
      tx: Ejecutor = bd,
    ): Promise<{ filas: FilaLote[]; total: number }> {
      const { rows } = await tx.query<FilaLote>(
        `SELECT ${CAMPOS_DE_LOTE} ${LOTE_CON_ESTADO} ORDER BY l.id DESC LIMIT $1 OFFSET $2`,
        [limite, desplazamiento],
      );
      const conteo = await tx.query<{ total: number }>(
        'SELECT COUNT(*)::int AS total FROM contenido.lote_generacion',
      );
      return { filas: rows, total: conteo.rows[0]?.total ?? 0 };
    },
  };
}

/** Escrituras de la creación del lote. */
function escrituras(bd: Ejecutor) {
  return {
    /** Serializa la creación de lotes: los topes y la deduplicación se deciden de a uno. */
    async bloquearCreacion(tx: Ejecutor = bd): Promise<void> {
      await tx.query("SELECT pg_advisory_xact_lock(hashtext('generador.crear_lote'))");
    },

    async crear(datos: DatosNuevoLote, tx: Ejecutor = bd): Promise<FilaLote> {
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO contenido.lote_generacion
           (contenido_id, solicitante_id, tipo_pregunta_id, con_texto, cantidad, modelo,
            version_instrucciones, estado_lote_id, creado_en)
         SELECT $1, $2, t.id, $3, $4, $5, $6, e.id, $7
           FROM contenido.tipo_pregunta t, contenido.estado_lote e
          WHERE t.codigo = 'seleccion_multiple' AND e.codigo = 'pendiente'
         RETURNING id::text AS id`,
        [
          datos.contenidoId,
          datos.solicitanteId,
          datos.conTexto,
          datos.cantidad,
          datos.modelo,
          datos.versionInstrucciones,
          datos.ahora,
        ],
      );
      return (await obtener(tx, rows[0]!.id))!;
    },
  };
}

/** Lo que un resultado suma al lote: una pregunta válida o descartada, y los tokens y el costo de la llamada. */
export interface AvanceDeLote {
  validas: number;
  descartadas: number;
  tokens: number | null;
  costoUsd: number | null;
  /** El modelo que respondió, si hubo respuesta. */
  modelo: string | null;
  motivos: unknown;
}

/** Lecturas del worker: qué lotes hay que trabajar y la fila reservada de uno. */
function lecturasDelWorker(bd: Ejecutor) {
  return {
    /** Los lotes pendientes sin texto de lectura (los de texto llegan con HU-18), los más antiguos primero. */
    async idsPendientes(tx: Ejecutor = bd): Promise<string[]> {
      const { rows } = await tx.query<{ id: string }>(
        `SELECT l.id::text AS id ${LOTE_CON_ESTADO} WHERE e.codigo = 'pendiente' AND NOT l.con_texto ORDER BY l.id`,
      );
      return rows.map((fila) => fila.id);
    },

    /** Reserva la fila del lote hasta el fin de la transacción y la devuelve con sus conteos al día. */
    async obtenerParaActualizar(id: string, tx: Ejecutor): Promise<FilaLote | null> {
      const { rows } = await tx.query<FilaLote>(
        `SELECT ${CAMPOS_DE_LOTE} ${LOTE_CON_ESTADO} WHERE l.id = $1 FOR UPDATE OF l`,
        [id],
      );
      return rows[0] ?? null;
    },
  };
}

/** Escrituras del worker sobre un lote: avance y cierre. Cada resultado se guarda en la transacción de su pregunta. */
function escriturasDelWorker(bd: Ejecutor) {
  return {
    async registrarAvance(id: string, avance: AvanceDeLote, tx: Ejecutor): Promise<void> {
      await tx.query(
        `UPDATE contenido.lote_generacion
            SET validas = validas + $2, descartadas = descartadas + $3,
                tokens_usados = CASE WHEN $4::int IS NULL THEN tokens_usados
                                     ELSE COALESCE(tokens_usados, 0) + $4::int END,
                costo_usd = CASE WHEN $5::numeric IS NULL THEN costo_usd
                                 ELSE COALESCE(costo_usd, 0) + $5::numeric END,
                modelo = COALESCE(left($6::text, 50), modelo), motivos_descarte = $7::jsonb
          WHERE id = $1`,
        [
          id,
          avance.validas,
          avance.descartadas,
          avance.tokens,
          avance.costoUsd,
          avance.modelo,
          JSON.stringify(avance.motivos),
        ],
      );
    },

    /** Cierra un lote pendiente; si otro proceso ya lo cerró, no hace nada y devuelve false. */
    async cerrar(
      id: string,
      estado: 'completado' | 'fallido',
      motivos: unknown,
      tx: Ejecutor = bd,
    ): Promise<boolean> {
      const { rowCount } = await tx.query(
        `UPDATE contenido.lote_generacion
            SET estado_lote_id = (SELECT id FROM contenido.estado_lote WHERE codigo = $2),
                motivos_descarte = $3::jsonb
          WHERE id = $1
            AND estado_lote_id = (SELECT id FROM contenido.estado_lote WHERE codigo = 'pendiente')`,
        [id, estado, JSON.stringify(motivos)],
      );
      return (rowCount ?? 0) > 0;
    },
  };
}

/** Totales para los topes (RNF-03). */
function totales(bd: Ejecutor) {
  return {
    /**
     * Preguntas del día de Chile que ya cuentan para el tope: de un lote pendiente, las que se pidieron;
     * de uno procesado, las que se llegaron a pedir a la IA (válidas y descartadas).
     */
    async usoDiario(ahora: Date, tx: Ejecutor = bd): Promise<number> {
      const { rows } = await tx.query<{ usadas: number }>(
        `SELECT COALESCE(SUM(CASE WHEN e.codigo = 'pendiente' THEN l.cantidad
                                  ELSE l.validas + l.descartadas END), 0)::int AS usadas
           ${LOTE_CON_ESTADO}
          WHERE (l.creado_en AT TIME ZONE 'America/Santiago')::date
              = ($1::timestamptz AT TIME ZONE 'America/Santiago')::date`,
        [ahora],
      );
      return rows[0]?.usadas ?? 0;
    },

    /** El gasto del mes de Chile y si algún lote del mes usó tokens sin tener costo (no verificable). */
    async gastoMensual(
      ahora: Date,
      tx: Ejecutor = bd,
    ): Promise<{ gastado: number; sinCosto: boolean }> {
      const { rows } = await tx.query<{ gastado: number; sinCosto: boolean }>(
        `SELECT COALESCE(SUM(costo_usd), 0)::float8 AS gastado,
                COALESCE(BOOL_OR(tokens_usados > 0 AND costo_usd IS NULL), false) AS "sinCosto"
           FROM contenido.lote_generacion
          WHERE date_trunc('month', creado_en AT TIME ZONE 'America/Santiago')
              = date_trunc('month', $1::timestamptz AT TIME ZONE 'America/Santiago')`,
        [ahora],
      );
      return rows[0] ?? { gastado: 0, sinCosto: false };
    },
  };
}

export function crearLotesRepositorio(bd: Ejecutor) {
  return {
    ...consultas(bd),
    ...escrituras(bd),
    ...lecturasDelWorker(bd),
    ...escriturasDelWorker(bd),
    ...totales(bd),
  };
}

export type LotesRepositorio = ReturnType<typeof crearLotesRepositorio>;
