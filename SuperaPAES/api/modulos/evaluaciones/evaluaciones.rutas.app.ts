// Rutas de /api/v1/app/evaluaciones (estudiante autenticado con el JWT de la app): evaluaciones
// (práctica, repaso, diagnóstico, mini-ensayo y ensayo completo), respuestas corregidas por la base,
// resultados, estadísticas y progreso.
// Incluye la estructura de cada evaluación (reparto por eje) y las tablas de conversión del DEMRE.
// Cada endpoint: router.<metodo>(ruta, validar(...), controlador.<accion>), con
// crearEvaluacionesControlador(servicio).
import { Router } from 'express';
import { validar } from '../../comun/middleware/validacion.js';
import { crearEvaluacionesControlador } from './evaluaciones.controlador.js';
import type { EvaluacionesServicio } from './evaluaciones.servicio.js';
import { esquemaIdPractica, esquemaInicioPractica } from './evaluaciones.validadores.js';

export function crearRutasAppEvaluaciones(servicio: EvaluacionesServicio): Router {
  const router = Router();
  const controlador = crearEvaluacionesControlador(servicio);
  router.post(
    '/practicas',
    validar({ cuerpo: esquemaInicioPractica }),
    controlador.iniciarPractica,
  );
  router.post(
    '/practicas/:id/siguiente',
    validar({ parametros: esquemaIdPractica }),
    controlador.siguientePregunta,
  );
  return router;
}
