// Módulo suscripciones: planes, suscripciones compradas en Google Play o la App Store, pagos,
// historial de estados y avisos de las tiendas.
// Exporta solo sus rutas y su servicio: los demás módulos lo usan a través del servicio.
export { crearRutasAppSuscripciones } from './suscripciones.rutas.app.js';
export { crearRutasAdminSuscripciones } from './suscripciones.rutas.admin.js';
export { crearRutasWebhooksSuscripciones } from './suscripciones.rutas.webhooks.js';
export {
  crearSuscripcionesServicio,
  type SuscripcionesServicio,
} from './suscripciones.servicio.js';
