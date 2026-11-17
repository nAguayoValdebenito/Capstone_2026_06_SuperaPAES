// SQL de los avisos de las tiendas (HU-44.1, RN-17): el registro único de cada aviso en
// app.evento_pasarela, la suscripción de la compra (o la pendiente ligada por la cuenta en la tienda) y
// su actualización. Consultas parametrizadas; cada método recibe el Ejecutor de la transacción.
import type { EstadoSuscripcion, Tienda } from '../../adaptadores/pagos/pasarela.js';
import type { Ejecutor } from '../../db/transaccion.js';
import { leerBloqueada, type FilaSuscripcion } from './suscripciones.compras.repositorio.js';

export type ResultadoAviso = 'procesado' | 'ignorado' | 'error';

/** El aviso en app.evento_pasarela y el resultado con que quedó (nuevo: recién registrado). */
export interface AvisoRegistrado {
  id: string;
  resultado: ResultadoAviso | 'nuevo';
}

export interface CierreAviso {
  resultado: ResultadoAviso;
  detalle: string | null;
  suscripcionId: string | null;
  pagoId: string | null;
  ahora: Date;
}

export interface CambioDeAviso {
  suscripcionId: string;
  estado: EstadoSuscripcion;
  planId: number;
  idCompraTienda: string;
  periodoFin: Date | null;
  canceladaEn: Date | null;
  ahora: Date;
}

// El aviso nuevo entra como «error, en proceso»: dentro de la transacción se cierra con su resultado,
// así que nadie lo ve así salvo que la transacción falle a mitad, y entonces la tienda lo reintenta.
const REGISTRAR = `
  INSERT INTO app.evento_pasarela
    (canal_venta_id, id_evento_pasarela, tipo, resultado_evento_id, detalle, recibido_en)
  SELECT c.id, $2, $3, r.id, 'En proceso', $4
    FROM contenido.canal_venta c, contenido.resultado_evento r
   WHERE c.codigo = $1 AND r.codigo = 'error'
  ON CONFLICT (id_evento_pasarela) DO NOTHING
  RETURNING id::text AS id`;

// Un aviso ya registrado se bloquea: si llegan dos iguales a la vez, el segundo espera al primero.
const BLOQUEAR = `
  SELECT a.id::text AS id, r.codigo AS resultado
    FROM app.evento_pasarela a
    JOIN contenido.resultado_evento r ON r.id = a.resultado_evento_id
   WHERE a.id_evento_pasarela = $1
     FOR UPDATE OF a`;

const CERRAR = `
  UPDATE app.evento_pasarela
     SET resultado_evento_id = (SELECT id FROM contenido.resultado_evento WHERE codigo = $2::text),
         detalle = $3, suscripcion_id = $4, pago_id = $5,
         procesado_en = CASE WHEN $2::text = 'error' THEN NULL ELSE $6::timestamptz END
   WHERE id = $1`;

const APLICAR = `
  UPDATE app.suscripcion
     SET estado_suscripcion_id = (SELECT id FROM contenido.estado_suscripcion WHERE codigo = $2::text),
         plan_id = $3,
         id_compra_tienda = $4,
         periodo_fin = $5,
         cancelada_en = $6,
         inicio = CASE WHEN $2::text = 'activa' THEN COALESCE(inicio, $7) ELSE inicio END
   WHERE id = $1`;

const EN_TIENDA = '(SELECT id FROM contenido.canal_venta WHERE codigo = $2)';

/** El registro único de cada aviso en app.evento_pasarela y el pago de su cobro. */
function registroDeAvisos(bd: Ejecutor) {
  return {
    /** Registra el aviso, o bloquea el que ya estaba con el mismo identificador. */
    async registrar(
      aviso: { tienda: Tienda; idEvento: string; tipo: string },
      ahora: Date,
      tx: Ejecutor = bd,
    ): Promise<AvisoRegistrado> {
      const nuevo = await tx.query<{ id: string }>(REGISTRAR, [
        aviso.tienda,
        aviso.idEvento,
        aviso.tipo.slice(0, 60),
        ahora,
      ]);
      const id = nuevo.rows[0]?.id;
      if (id !== undefined) return { id, resultado: 'nuevo' };
      const { rows } = await tx.query<AvisoRegistrado>(BLOQUEAR, [aviso.idEvento]);
      const existente = rows[0];
      if (!existente) throw new Error('El aviso repetido no se encontró al bloquearlo.');
      return existente;
    },

    async cerrar(id: string, cierre: CierreAviso, tx: Ejecutor = bd): Promise<void> {
      await tx.query(CERRAR, [
        id,
        cierre.resultado,
        cierre.detalle?.slice(0, 300) ?? null,
        cierre.suscripcionId,
        cierre.pagoId,
        cierre.ahora,
      ]);
    },

    /** El pago de ese cobro en la suscripción, si ya está registrado. */
    async pagoId(
      suscripcionId: string,
      idPagoPasarela: string,
      tx: Ejecutor = bd,
    ): Promise<string | null> {
      const { rows } = await tx.query<{ id: string }>(
        'SELECT id::text AS id FROM app.pago WHERE suscripcion_id = $1 AND id_pago_pasarela = $2',
        [suscripcionId, idPagoPasarela],
      );
      return rows[0]?.id ?? null;
    },
  };
}

/** La suscripción del aviso y su actualización. */
function suscripcionDelAviso(bd: Ejecutor) {
  return {
    /** La suscripción de esa compra en esa tienda, bloqueada. */
    porCompra(tienda: Tienda, idCompraTienda: string, tx: Ejecutor = bd) {
      return leerBloqueada(tx, `s.id_compra_tienda = $1 AND s.canal_venta_id = ${EN_TIENDA}`, [
        idCompraTienda,
        tienda,
      ]);
    },

    /** Pendientes y fallidas de la tienda todavía sin compra: las que un aviso puede ligar por la cuenta. */
    async sinCompra(tienda: Tienda, tx: Ejecutor = bd): Promise<string[]> {
      const { rows } = await tx.query<{ id: string }>(
        `SELECT s.id::text AS id FROM app.suscripcion s
           JOIN contenido.estado_suscripcion e ON e.id = s.estado_suscripcion_id
          WHERE e.codigo IN ('pendiente', 'fallida') AND s.id_compra_tienda IS NULL
            AND s.canal_venta_id = (SELECT id FROM contenido.canal_venta WHERE codigo = $1)`,
        [tienda],
      );
      return rows.map((fila) => fila.id);
    },

    /** La suscripción con ese id, bloqueada, si sigue sin compra (otra transacción pudo ligarla). */
    bloquearSinCompra(id: string, tx: Ejecutor = bd): Promise<FilaSuscripcion | null> {
      return leerBloqueada(tx, 's.id = $1 AND s.id_compra_tienda IS NULL', [id]);
    },

    async canceladaEn(id: string, tx: Ejecutor = bd): Promise<Date | null> {
      const { rows } = await tx.query<{ canceladaEn: Date | null }>(
        'SELECT cancelada_en AS "canceladaEn" FROM app.suscripcion WHERE id = $1',
        [id],
      );
      return rows[0]?.canceladaEn ?? null;
    },

    async aplicar(cambio: CambioDeAviso, tx: Ejecutor = bd): Promise<void> {
      await tx.query(APLICAR, [
        cambio.suscripcionId,
        cambio.estado,
        cambio.planId,
        cambio.idCompraTienda,
        cambio.periodoFin,
        cambio.canceladaEn,
        cambio.ahora,
      ]);
    },
  };
}

export function crearAvisosRepositorio(bd: Ejecutor) {
  return { ...registroDeAvisos(bd), ...suscripcionDelAviso(bd) };
}

export type AvisosRepositorio = ReturnType<typeof crearAvisosRepositorio>;
