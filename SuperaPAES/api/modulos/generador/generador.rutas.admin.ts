// Rutas de /api/v1/admin/generador (consola, JWT de la consola, rol admin): lotes de generación de
// preguntas con IA (la cola la consume el worker de trabajos/).
// Cada ruta declara su rol (DAS 4.3.3); el módulo no aplica un rol común.
// Cada endpoint: router.<metodo>(ruta, exigirRol(...), validar(...), controlador.<accion>), con
// crearGeneradorControlador(servicio).
import { Router } from 'express';
import type { GeneradorServicio } from './generador.servicio.js';

export function crearRutasAdminGenerador(_servicio: GeneradorServicio): Router {
  const router = Router();
  return router;
}
