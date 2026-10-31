// Suscripciones de prueba para las pruebas con PostgreSQL real: se insertan directo en app.suscripcion
// (y en app.suscripcion_prueba, la prueba elegida de «Una prueba») con el estado indicado. La vigencia
// la pone la base. No escriben historial: sirven para leer el estado, no para cambiarlo.
import type { Ejecutor } from '../db/transaccion.js';

export interface SuscripcionDePrueba {
  estudianteId: string;
  /** Nombre del plan en contenido.plan, por ejemplo «Todas las pruebas mensual». */
  plan: string;
  /** Código de contenido.estado_suscripcion. */
  estado: string;
  /** Código de contenido.canal_venta. */
  tienda?: 'google_play' | 'app_store';
  /** Pruebas de app.suscripcion_prueba (la elegida en «Una prueba»). */
  pruebas?: number[];
}

/** Inserta la suscripción y devuelve su id. */
export async function insertarSuscripcion(
  bd: Ejecutor,
  { estudianteId, plan, estado, tienda = 'google_play', pruebas = [] }: SuscripcionDePrueba,
): Promise<string> {
  const { rows } = await bd.query<{ id: string }>(
    `INSERT INTO app.suscripcion
       (estudiante_id, plan_id, estado_suscripcion_id, vigente, canal_venta_id, inicio, creado_en)
     SELECT $1, pl.id, e.id, e.vigente, c.id, now(), now()
       FROM contenido.plan pl, contenido.estado_suscripcion e, contenido.canal_venta c
      WHERE pl.nombre = $2 AND e.codigo = $3 AND c.codigo = $4
     RETURNING id::text AS id`,
    [estudianteId, plan, estado, tienda],
  );
  const id = rows[0]?.id;
  if (!id)
    throw new Error(`No existe el plan «${plan}», el estado ${estado} o la tienda ${tienda}.`);
  for (const prueba of pruebas) {
    await bd.query(
      'INSERT INTO app.suscripcion_prueba (suscripcion_id, prueba_id) VALUES ($1, $2)',
      [id, prueba],
    );
  }
  return id;
}

/** La suscripción tal como quedó en la base, con su prueba elegida. */
export async function suscripcionGuardada(bd: Ejecutor, id: number) {
  const { rows } = await bd.query<Record<string, unknown>>(
    `SELECT e.codigo AS estado, s.vigente, s.plan_id AS "planId", c.codigo AS tienda,
            s.id_compra_tienda AS "idCompraTienda", s.inicio, s.periodo_fin AS "periodoFin",
            s.creado_en AS "creadoEn",
            (SELECT array_agg(prueba_id) FROM app.suscripcion_prueba WHERE suscripcion_id = s.id)
              AS pruebas
       FROM app.suscripcion s
       JOIN contenido.estado_suscripcion e ON e.id = s.estado_suscripcion_id
       JOIN contenido.canal_venta c ON c.id = s.canal_venta_id
      WHERE s.id = $1`,
    [id],
  );
  return rows[0];
}

/** El historial de la suscripción (app.suscripcion_evento), en orden. */
export async function historialDe(bd: Ejecutor, id: number) {
  const { rows } = await bd.query<Record<string, unknown>>(
    `SELECT ea.codigo AS "estadoAnterior", en.codigo AS "estadoNuevo",
            h.plan_anterior_id AS "planAnterior", h.plan_nuevo_id AS "planNuevo",
            o.codigo AS origen, h.creado_en AS "creadoEn"
       FROM app.suscripcion_evento h
       LEFT JOIN contenido.estado_suscripcion ea ON ea.id = h.estado_anterior_id
       JOIN contenido.estado_suscripcion en ON en.id = h.estado_nuevo_id
       JOIN contenido.origen_evento o ON o.id = h.origen_evento_id
      WHERE h.suscripcion_id = $1
      ORDER BY h.creado_en, h.id`,
    [id],
  );
  return rows;
}

/** Los pagos de la suscripción (app.pago), con sus fechas como texto. */
export async function pagosDe(bd: Ejecutor, id: number) {
  const { rows } = await bd.query<Record<string, unknown>>(
    `SELECT p.id_pago_pasarela AS "idPagoPasarela", p.monto_clp AS "montoClp", e.codigo AS estado,
            to_char(p.periodo_inicio, 'YYYY-MM-DD') AS "periodoInicio",
            to_char(p.periodo_fin, 'YYYY-MM-DD') AS "periodoFin"
       FROM app.pago p JOIN contenido.estado_pago e ON e.id = p.estado_pago_id
      WHERE p.suscripcion_id = $1
      ORDER BY p.id`,
    [id],
  );
  return rows;
}
