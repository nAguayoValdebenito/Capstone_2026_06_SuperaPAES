// Persistencia de la respuesta a una pregunta de práctica (HU-32.1). La corrección la calcula el
// trigger tg_item con la clave de la versión que vio el estudiante: aquí nunca se escribe es_correcta.
// Lo corregido se lee solo de app.v_item_evaluacion, que lo muestra cuando el ítem ya está corregido.
import type { Ejecutor } from '../../db/transaccion.js';
import type { TipoConsumo } from '../cupo-invitaciones/index.js';

export interface ItemParaResponder {
  pruebaId: number;
  respondida: boolean;
  cerrada: boolean;
  venceEn: Date | null;
  consumeCupo: boolean;
}

export interface RespuestaNueva {
  itemId: string;
  alternativaId: number;
  /** Hora del reloj del servicio: respondida_en y el tiempo utilizado. */
  ahora: Date;
  /** Lo que se descontó; null si el tipo de evaluación no consume cupo. */
  tipoConsumo: TipoConsumo | null;
}

export interface ItemCorregido {
  esCorrecta: boolean | null;
  alternativaElegidaId: string;
  alternativaCorrectaId: string;
  explicacion: string | null;
  alternativas: {
    id: string | number;
    letra: string;
    texto: string;
    explicacion?: string | null;
  }[];
}

const consultasRespuestas = {
  /**
   * El ítem de esa evaluación del estudiante, si es de una práctica, con la evaluación y el ítem
   * bloqueados (FOR UPDATE) hasta el fin de la transacción.
   */
  async bloquearItem(
    evaluacionId: string,
    itemId: string,
    estudianteId: string,
    tx: Ejecutor,
  ): Promise<ItemParaResponder | null> {
    const { rows } = await tx.query<ItemParaResponder>(
      `SELECT i.prueba_id AS "pruebaId", i.respondida_en IS NOT NULL AS respondida,
          e.cerrada_en IS NOT NULL AS cerrada, e.vence_en AS "venceEn", t.consume_cupo AS "consumeCupo"
         FROM app.evaluacion e
         JOIN app.evaluacion_item i ON i.evaluacion_id = e.id
         JOIN contenido.tipo_evaluacion t ON t.id = e.tipo_evaluacion_id
        WHERE e.id = $1 AND i.id = $2 AND e.estudiante_id = $3 AND t.codigo = 'practica'
        FOR UPDATE OF e, i`,
      [evaluacionId, itemId, estudianteId],
    );
    return rows[0] ?? null;
  },
  /** Ids de las alternativas de la versión que vio el estudiante, como texto. */
  async alternativasVisibles(itemId: string, tx: Ejecutor): Promise<string[]> {
    const { rows } = await tx.query<{ id: string }>(
      `SELECT a ->> 'id' AS id
         FROM app.v_item_evaluacion v, jsonb_array_elements(v.alternativas) a
        WHERE v.evaluacion_item_id = $1`,
      [itemId],
    );
    return rows.map(({ id }) => id);
  },
  /** Guarda la respuesta si el ítem sigue sin responder; el tiempo nunca es negativo. */
  async guardarRespuesta(respuesta: RespuestaNueva, tx: Ejecutor): Promise<boolean> {
    const { rowCount } = await tx.query(
      `UPDATE app.evaluacion_item i
          SET alternativa_id = $2, respondida_en = $3,
              tiempo_seg = GREATEST(0, floor(extract(epoch FROM $3::timestamptz - i.entregada_en)))::int,
              tipo_consumo_id = (SELECT id FROM contenido.tipo_consumo WHERE codigo = $4)
        WHERE i.id = $1 AND i.respondida_en IS NULL`,
      [respuesta.itemId, respuesta.alternativaId, respuesta.ahora, respuesta.tipoConsumo],
    );
    return rowCount === 1;
  },
  async leerCorreccion(
    itemId: string,
    estudianteId: string,
    tx: Ejecutor,
  ): Promise<ItemCorregido | null> {
    const { rows } = await tx.query<ItemCorregido>(
      `SELECT es_correcta AS "esCorrecta", alternativa_elegida::text AS "alternativaElegidaId",
          alternativa_correcta_id::text AS "alternativaCorrectaId", explicacion,
          alternativas_con_explicacion AS alternativas
         FROM app.v_item_evaluacion
        WHERE evaluacion_item_id = $1 AND estudiante_id = $2 AND corregida`,
      [itemId, estudianteId],
    );
    return rows[0] ?? null;
  },
};

export function crearRespuestasRepositorio() {
  return consultasRespuestas;
}

export type RespuestasRepositorio = ReturnType<typeof crearRespuestasRepositorio>;
