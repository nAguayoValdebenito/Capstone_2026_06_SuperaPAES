// Rutas de /api/v1/app/temario (estudiante autenticado con el JWT de la app): áreas, pruebas,
// habilidades, ejes y contenidos del temario PAES.
// Cada endpoint: router.<metodo>(ruta, validar(...), controlador.<accion>), con crearTemarioControlador(servicio).
import { Router } from 'express';
import type { TemarioServicio } from './temario.servicio.js';

export function crearRutasAppTemario(_servicio: TemarioServicio): Router {
  return Router();
}
