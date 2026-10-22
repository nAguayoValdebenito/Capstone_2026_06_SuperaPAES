// Único lugar con SQL del módulo suscripciones. Consultas siempre parametrizadas ($1, $2...).
// Tablas que pertenecen a este módulo (ningún otro módulo las escribe):
//   - contenido.plan
//   - contenido.plan_producto_tienda
//   - app.suscripcion
//   - app.suscripcion_prueba
//   - app.pago
//   - app.suscripcion_evento
//   - app.evento_pasarela
//   - vista app.v_resumen_suscripciones
//   - vista app.v_pagos_mes
// Cada método recibe un Ejecutor opcional (tx) para sumarse a la transacción del servicio.
import type { Ejecutor } from '../../db/transaccion.js';

export type SuscripcionesRepositorio = Record<string, never>;

/** @esqueleto Lo usará el servicio del módulo cuando implemente su primera consulta. */
export function crearSuscripcionesRepositorio(_bd: Ejecutor): SuscripcionesRepositorio {
  return {};
}
