// Esquemas zod de entrada del módulo suscripciones. Se usan con validar() en las rutas.
import { z } from 'zod';

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
