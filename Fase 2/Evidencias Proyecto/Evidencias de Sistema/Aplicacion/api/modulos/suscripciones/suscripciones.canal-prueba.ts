// Canal de las suscripciones simuladas del modo de pruebas (MODO_PRUEBAS_SUSCRIPCION, migración 012). No es
// una tienda: nunca llega a PasarelasPorTienda, no tiene productos en contenido.plan_producto_tienda y las
// consultas de compras, avisos, cierre y renovación lo dejan fuera.
import type { Tienda } from '../../adaptadores/pagos/pasarela.js';

/** Código de contenido.canal_venta de la suscripción simulada. */
export const CANAL_PRUEBA = 'prueba';

/** Dónde está una suscripción: una tienda real o el canal simulado. */
export type CanalSuscripcion = Tienda | typeof CANAL_PRUEBA;
