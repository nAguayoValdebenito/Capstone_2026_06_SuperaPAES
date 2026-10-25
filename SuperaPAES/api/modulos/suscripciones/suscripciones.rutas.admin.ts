// Rutas de /api/v1/admin/suscripciones (consola, JWT de la consola, rol admin): planes,
// suscripciones compradas en Google Play o la App Store, pagos, historial de estados y avisos de
// las tiendas.
// Cada ruta declara su rol (DAS 4.3.3); el módulo no aplica un rol común.
// Cada endpoint: router.<metodo>(ruta, exigirRol(...), validar(...), controlador.<accion>), con
// crearSuscripcionesControlador(servicio).
import { Router } from 'express';
import type { SuscripcionesServicio } from './suscripciones.servicio.js';

export function crearRutasAdminSuscripciones(_servicio: SuscripcionesServicio): Router {
  const router = Router();
  return router;
}
