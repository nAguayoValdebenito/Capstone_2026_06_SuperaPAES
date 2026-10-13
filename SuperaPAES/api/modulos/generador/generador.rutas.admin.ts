// Rutas de /api/v1/admin/generador (consola, JWT de la consola, rol admin): lotes de generación de
// preguntas con IA (la cola la consume el worker de trabajos/).
// Cada endpoint: router.<metodo>(ruta, validar(...), controlador.<accion>), con
// crearGeneradorControlador(servicio).
import { Router } from 'express';
import { exigirRol } from '../../comun/middleware/autorizacion.js';
import type { GeneradorServicio } from './generador.servicio.js';

export function crearRutasAdminGenerador(_servicio: GeneradorServicio): Router {
  const router = Router();
  router.use(exigirRol('admin'));
  return router;
}
