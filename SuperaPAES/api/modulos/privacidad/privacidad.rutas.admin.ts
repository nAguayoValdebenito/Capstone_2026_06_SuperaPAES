// Rutas de /api/v1/admin/privacidad (consola, JWT de la consola, rol admin): solicitudes de
// derechos sobre datos personales (Ley 21.719), exportación y borrado de la cuenta con
// seudonimización.
// Cada ruta declara su rol (DAS 4.3.3); el módulo no aplica un rol común.
// Cada endpoint: router.<metodo>(ruta, exigirRol(...), validar(...), controlador.<accion>), con
// crearPrivacidadControlador(servicio).
import { Router } from 'express';
import type { PrivacidadServicio } from './privacidad.servicio.js';

export function crearRutasAdminPrivacidad(_servicio: PrivacidadServicio): Router {
  const router = Router();
  return router;
}
