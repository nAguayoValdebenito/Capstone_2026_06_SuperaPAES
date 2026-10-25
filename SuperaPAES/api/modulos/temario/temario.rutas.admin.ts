// Rutas de /api/v1/admin/temario (consola, JWT de la consola, rol admin): áreas, pruebas,
// habilidades, ejes y contenidos del temario PAES, y las pruebas que sugiere cada área de carrera.
// Cada ruta declara su rol (DAS 4.3.3); el módulo no aplica un rol común.
// Cada endpoint: router.<metodo>(ruta, exigirRol(...), validar(...), controlador.<accion>), con
// crearTemarioControlador(servicio).
import { Router } from 'express';
import { exigirRol } from '../../comun/middleware/autorizacion.js';
import { crearTemarioControlador } from './temario.controlador.js';
import type { TemarioServicio } from './temario.servicio.js';

export function crearRutasAdminTemario(servicio: TemarioServicio): Router {
  const router = Router();
  const controlador = crearTemarioControlador(servicio);

  router.get('/areas', exigirRol('admin'), controlador.listarAreas);
  return router;
}
