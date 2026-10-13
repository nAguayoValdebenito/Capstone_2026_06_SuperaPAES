// Rutas de /api/v1/admin/administracion (consola, JWT de la consola, rol admin): gestión de
// usuarios internos y especialidades, parámetros del sistema (contenido.configuracion), auditoría,
// panel de métricas y consulta de estudiantes.
// Cada endpoint: router.<metodo>(ruta, validar(...), controlador.<accion>), con
// crearAdministracionControlador(servicio).
import { Router } from 'express';
import { exigirRol } from '../../comun/middleware/autorizacion.js';
import type { AdministracionServicio } from './administracion.servicio.js';

export function crearRutasAdminAdministracion(_servicio: AdministracionServicio): Router {
  const router = Router();
  router.use(exigirRol('admin'));
  return router;
}
