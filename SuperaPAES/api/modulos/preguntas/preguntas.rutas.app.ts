// Rutas de /api/v1/app/preguntas (estudiante autenticado con el JWT de la app): banco de preguntas,
// alternativas, versiones, textos de estímulo, importaciones y avisos de error de los estudiantes.
// Cada endpoint: router.<metodo>(ruta, validar(...), controlador.<accion>), con
// crearPreguntasControlador(servicio).
import { Router } from 'express';
import type { PreguntasServicio } from './preguntas.servicio.js';

export function crearRutasAppPreguntas(_servicio: PreguntasServicio): Router {
  return Router();
}
