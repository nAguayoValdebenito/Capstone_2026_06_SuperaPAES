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
