// Historia de suscripciones para las pruebas con PostgreSQL de la trazabilidad (HU-56): pagos, avisos de
// las tiendas y cambios de estado o de plan, insertados directo en las tablas del modelo. Las reglas las
// pone la base: el historial parte del último registro y un cambio de la tienda apunta a su aviso (RN-17).
import type { Ejecutor } from '../db/transaccion.js';

export const RUTA_SUSCRIPCIONES = '/api/v1/admin/suscripciones';

/** Agrega un pago que empieza hoy en Chile, con el estado y el monto indicados; devuelve su id. */
export async function agregarPago(
  bd: Ejecutor,
  suscripcionId: string,
  [estado, montoClp]: [string, number],
): Promise<string> {
  const { rows } = await bd.query<{ id: string }>(
    `INSERT INTO app.pago (suscripcion_id, id_pago_pasarela, monto_clp, estado_pago_id,
                           periodo_inicio, periodo_fin, creado_en)
     SELECT $1::bigint, 'pago-' || $1::text || '-' || $2, $3, e.id, hoy, hoy + 30, now()
       FROM contenido.estado_pago e, (SELECT (now() AT TIME ZONE 'America/Santiago')::date AS hoy) c
      WHERE e.codigo = $2
     RETURNING id::text AS id`,
    [suscripcionId, estado, montoClp],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error(`No existe el estado de pago ${estado}.`);
  return id;
}

/** Agrega un aviso de Google Play: procesado, de la suscripción o del pago, o con error y su motivo. */
export async function agregarAviso(
  bd: Ejecutor,
  [idEvento, tipo]: [string, string],
  { suscripcion = null, pago = null, error = null }: Record<string, string | null> = {},
): Promise<void> {
  await bd.query(
    `INSERT INTO app.evento_pasarela (canal_venta_id, id_evento_pasarela, tipo, suscripcion_id, pago_id,
                                      resultado_evento_id, detalle, recibido_en, procesado_en)
     SELECT c.id, $1, $2, $3::bigint, $4::bigint, r.id, $5::text, now(), CASE WHEN $5::text IS NULL THEN now() END
       FROM contenido.canal_venta c, contenido.resultado_evento r
      WHERE c.codigo = 'google_play' AND r.codigo = CASE WHEN $5::text IS NULL THEN 'procesado' ELSE 'error' END`,
    [idEvento, tipo, suscripcion, pago, error],
  );
}

type EstadoYPlan = [estado: string, plan: string];

/** Agrega un cambio al historial: de [estado, plan] (null el primero) al nuevo, con su origen y aviso. */
export async function agregarEvento(
  bd: Ejecutor,
  suscripcionId: string,
  [antes, despues]: [EstadoYPlan | null, EstadoYPlan],
  [origen, aviso = null]: [string, (string | null)?],
): Promise<void> {
  await bd.query(
    `INSERT INTO app.suscripcion_evento (suscripcion_id, estado_anterior_id, plan_anterior_id,
                                         estado_nuevo_id, plan_nuevo_id, origen_evento_id,
                                         evento_pasarela_id, creado_en)
     SELECT $1, (SELECT id FROM contenido.estado_suscripcion WHERE codigo = $2),
            (SELECT id FROM contenido.plan WHERE nombre = $3),
            (SELECT id FROM contenido.estado_suscripcion WHERE codigo = $4),
            (SELECT id FROM contenido.plan WHERE nombre = $5),
            (SELECT id FROM contenido.origen_evento WHERE codigo = $6),
            (SELECT id FROM app.evento_pasarela WHERE id_evento_pasarela = $7), now()`,
    [suscripcionId, antes?.[0] ?? null, antes?.[1] ?? null, ...despues, origen, aviso],
  );
}
