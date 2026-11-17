// Rutas de /api/v1/app/preguntas (estudiante autenticado con el JWT de la app).
// HU-37 (A23): los motivos para avisar un error. El aviso se envía sobre un ítem recibido, en
// /api/v1/app/evaluaciones/:id/items/:item/avisos (evaluaciones es dueño del ítem).
import { Router } from 'express';
import { crearPreguntasControlador } from './preguntas.controlador.js';
import type { PreguntasServicio } from './preguntas.servicio.js';

export function crearRutasAppPreguntas(servicio: PreguntasServicio): Router {
  const router = Router();
  const controlador = crearPreguntasControlador(servicio);
  router.get('/avisos/motivos', controlador.motivosDeAvisoApp);
  return router;
}
