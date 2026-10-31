// Esquemas zod de entrada del módulo suscripciones. Se usan con validar() en las rutas.
import { z } from 'zod';
import { idDeRuta } from '../../comun/identificadores.js';

/** Ids de contenido.plan y contenido.prueba (SMALLINT). */
const identificador = z.number().int().positive().max(32767);
const tienda = z.enum(['google_play', 'app_store']);

/** POST /app/suscripciones (CU-12 paso 3): el plan, la tienda del teléfono y, en Una prueba, la prueba. */
export const esquemaNuevaSuscripcion = z.strictObject({
  planId: identificador,
  tienda,
  pruebaId: identificador.optional(),
});

export type DatosNuevaSuscripcion = z.infer<typeof esquemaNuevaSuscripcion>;

/** POST /app/suscripciones/{id}/compra: la suscripción del estudiante. */
export const esquemaIdSuscripcion = z.object({ id: idDeRuta });

/**
 * POST /app/suscripciones/{id}/compra (HU-43.1): el token de compra de Google Play o el id de la
 * transacción de la App Store (app.suscripcion.id_compra_tienda admite 200 caracteres) y, al bajar a
 * Una prueba, la prueba elegida. Nada más: el estado lo decide la tienda, no la app.
 */
export const esquemaCompra = z.strictObject({
  idCompraTienda: z.string().min(1).max(200),
  pruebaId: identificador.optional(),
});

export type DatosCompra = z.infer<typeof esquemaCompra>;
