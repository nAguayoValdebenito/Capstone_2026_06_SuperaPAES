// Rutas de /api/v1/app/evaluaciones (estudiante autenticado con el JWT de la app): evaluaciones
// (práctica, repaso, diagnóstico, mini-ensayo y ensayo completo), respuestas corregidas por la base,
// resultados, estadísticas y progreso.
// Incluye la estructura de cada evaluación (reparto por eje) y las tablas de conversión del DEMRE.
// Cada endpoint: router.<metodo>(ruta, validar(...), controlador.<accion>), con
// crearEvaluacionesControlador(servicio).
import { Router } from 'express';
import type { EvaluacionesServicio } from './evaluaciones.servicio.js';

export function crearRutasAppEvaluaciones(_servicio: EvaluacionesServicio): Router {
  return Router();
}
