// Rutas de /api/v1/webhooks: avisos de Google Play (Cloud Pub/Sub, notificaciones RTDN) y de la
// App Store (App Store Server Notifications V2). No usan JWT: cada pasarela verifica el envío.
import { Router } from 'express';
import { crearSuscripcionesControlador } from './suscripciones.controlador.js';
import type { SuscripcionesServicio } from './suscripciones.servicio.js';

export function crearRutasWebhooksSuscripciones(servicio: SuscripcionesServicio): Router {
  const router = Router();
  const controlador = crearSuscripcionesControlador(servicio);
  router.post('/google-play', controlador.avisoGooglePlay);
  router.post('/app-store', controlador.avisoAppStore);
  return router;
}
