// Rutas de /api/v1/app/suscripciones (estudiante autenticado con el JWT de la app): planes,
// suscripciones compradas en Google Play o la App Store, pagos, historial de estados y avisos de
// las tiendas.
// Cada endpoint: router.<metodo>(ruta, validar(...), controlador.<accion>), con
// crearSuscripcionesControlador(servicio).
import { Router } from 'express';
import type { SuscripcionesServicio } from './suscripciones.servicio.js';

export function crearRutasAppSuscripciones(_servicio: SuscripcionesServicio): Router {
  return Router();
}
