// Rutas de /api/v1/admin/temario (consola, JWT de la consola, rol admin): áreas, pruebas,
// habilidades, ejes y contenidos del temario PAES.
// Cada endpoint: router.<metodo>(ruta, validar(...), controlador.<accion>), con crearTemarioControlador(servicio).
import { Router } from 'express';
import { exigirRol } from '../../comun/middleware/autorizacion.js';
import type { TemarioServicio } from './temario.servicio.js';

export function crearRutasAdminTemario(_servicio: TemarioServicio): Router {
  const router = Router();
  router.use(exigirRol('admin'));
  return router;
}
