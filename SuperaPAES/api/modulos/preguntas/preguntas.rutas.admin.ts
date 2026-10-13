// Rutas de /api/v1/admin/preguntas (consola, JWT de la consola, rol admin): banco de preguntas,
// alternativas, versiones, textos de estímulo, importaciones y avisos de error de los estudiantes.
// Cada endpoint: router.<metodo>(ruta, validar(...), controlador.<accion>), con
// crearPreguntasControlador(servicio).
import { Router } from 'express';
import { exigirRol } from '../../comun/middleware/autorizacion.js';
import type { PreguntasServicio } from './preguntas.servicio.js';

export function crearRutasAdminPreguntas(_servicio: PreguntasServicio): Router {
  const router = Router();
  router.use(exigirRol('admin'));
  return router;
}
