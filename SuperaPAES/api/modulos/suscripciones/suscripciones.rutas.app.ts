// Rutas de /api/v1/app/suscripciones (estudiante autenticado con el JWT de la app): planes,
// suscripciones compradas en Google Play o la App Store, pagos, historial de estados y avisos de
// las tiendas.
// Cada endpoint: router.<metodo>(ruta, validar(...), controlador.<accion>), con
// crearSuscripcionesControlador(servicio).
import { Router } from 'express';
import { validar } from '../../comun/middleware/validacion.js';
import { crearSuscripcionesControlador } from './suscripciones.controlador.js';
import type { SuscripcionesServicio } from './suscripciones.servicio.js';
import { esquemaNuevaSuscripcion } from './suscripciones.validadores.js';

export function crearRutasAppSuscripciones(servicio: SuscripcionesServicio): Router {
  const router = Router();
  const controlador = crearSuscripcionesControlador(servicio);
  // HU-43.1, CU-12 paso 3: la suscripción pendiente que la app compra en la tienda (A43).
  router.post('/', validar({ cuerpo: esquemaNuevaSuscripcion }), controlador.crearSuscripcion);
  return router;
}
