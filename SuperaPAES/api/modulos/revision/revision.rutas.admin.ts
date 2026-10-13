// Rutas de /api/v1/admin/revision (consola, JWT de la consola, rol admin o docente): asignaciones a
// docentes, revisiones con la pauta, desempate y clasificación de dificultad.
// Cada endpoint: router.<metodo>(ruta, validar(...), controlador.<accion>), con
// crearRevisionControlador(servicio).
import { Router } from 'express';
import { exigirRol } from '../../comun/middleware/autorizacion.js';
import type { RevisionServicio } from './revision.servicio.js';

export function crearRutasAdminRevision(_servicio: RevisionServicio): Router {
  const router = Router();
  router.use(exigirRol('admin', 'docente'));
  return router;
}
