// Rutas de /api/v1/app/privacidad (estudiante autenticado con el JWT de la app): solicitudes de
// derechos sobre datos personales (Ley 21.719), exportación y borrado de la cuenta con
// seudonimización.
// Cada endpoint: router.<metodo>(ruta, validar(...), controlador.<accion>), con
// crearPrivacidadControlador(servicio).
import { Router } from 'express';
import { crearPrivacidadControlador } from './privacidad.controlador.js';
import type { PrivacidadServicio } from './privacidad.servicio.js';

export function crearRutasAppPrivacidad(servicio: PrivacidadServicio): Router {
  const router = Router();
  const controlador = crearPrivacidadControlador(servicio);
  // HU-07.1: «Descargar mis datos» (A39).
  router.get('/mis-datos', controlador.exportarDatos);
  return router;
}
