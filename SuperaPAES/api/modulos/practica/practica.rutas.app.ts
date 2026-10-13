// Rutas de /api/v1/app/practica (estudiante autenticado con el JWT de la app): sesiones de
// práctica, diagnóstico, repaso y ensayos, entregas, respuestas corregidas en el servidor,
// estadísticas y progreso.
// Cada endpoint: router.<metodo>(ruta, validar(...), controlador.<accion>), con
// crearPracticaControlador(servicio).
import { Router } from 'express';
import type { PracticaServicio } from './practica.servicio.js';

export function crearRutasAppPractica(_servicio: PracticaServicio): Router {
  return Router();
}
