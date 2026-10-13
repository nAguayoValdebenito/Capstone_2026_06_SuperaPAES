// Rutas de /api/v1/admin/suscripciones (consola, JWT de la consola, rol admin): planes,
// suscripciones compradas en Google Play o la App Store, pagos, historial de estados y avisos de
// las tiendas.
// Cada endpoint: router.<metodo>(ruta, validar(...), controlador.<accion>), con
// crearSuscripcionesControlador(servicio).
import { Router } from 'express';
import { exigirRol } from '../../comun/middleware/autorizacion.js';
import type { SuscripcionesServicio } from './suscripciones.servicio.js';

export function crearRutasAdminSuscripciones(_servicio: SuscripcionesServicio): Router {
  const router = Router();
  router.use(exigirRol('admin'));
  return router;
}
