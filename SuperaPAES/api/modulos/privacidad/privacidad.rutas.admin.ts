// Rutas de /api/v1/admin/privacidad (consola, JWT de la consola, rol admin): solicitudes de
// derechos sobre datos personales (Ley 21.719), exportación y borrado de la cuenta con
// seudonimización.
// Cada endpoint: router.<metodo>(ruta, validar(...), controlador.<accion>), con
// crearPrivacidadControlador(servicio).
import { Router } from 'express';
import { exigirRol } from '../../comun/middleware/autorizacion.js';
import type { PrivacidadServicio } from './privacidad.servicio.js';

export function crearRutasAdminPrivacidad(_servicio: PrivacidadServicio): Router {
  const router = Router();
  router.use(exigirRol('admin'));
  return router;
}
