// Rutas de /api/v1/admin/preguntas (consola, JWT de la consola, rol admin): banco de preguntas,
// alternativas, versiones, textos de estímulo, importaciones y avisos de error de los estudiantes.
// Cada ruta declara su rol (DAS 4.3.3); el módulo no aplica un rol común.
// Cada endpoint: router.<metodo>(ruta, exigirRol(...), validar(...), controlador.<accion>), con
// crearPreguntasControlador(servicio).
import { Router } from 'express';
import type { PreguntasServicio } from './preguntas.servicio.js';

export function crearRutasAdminPreguntas(_servicio: PreguntasServicio): Router {
  const router = Router();
  return router;
}
