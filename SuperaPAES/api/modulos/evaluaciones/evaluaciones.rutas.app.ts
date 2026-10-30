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
import {
  esquemaIdEvaluacion,
  esquemaIdPractica,
  esquemaIdsItem,
  esquemaInicioPractica,
  esquemaRespuesta,
} from './evaluaciones.validadores.js';

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
  router.post(
    '/practicas/:id/cerrar',
    validar({ parametros: esquemaIdPractica }),
    controlador.cerrarPractica,
  );
  router.get(
    '/practicas/:id/resumen',
    validar({ parametros: esquemaIdPractica }),
    controlador.resumenPractica,
  );
  // HU-38.2: progreso por prueba, eje y habilidad, ejes a reforzar, semanas y ensayos (A35 y A36).
  router.get('/progreso', controlador.obtenerProgreso);
  // HU-60.1: la evaluación sin terminar para retomarla (A12 y A29); cierra la vencida o inactiva.
  router.get('/abierta', controlador.evaluacionAbierta);
  // HU-61.1: resultado y revisión pregunta por pregunta de cualquier evaluación cerrada (A30 a A33).
  router.get(
    '/:id/resultado',
    validar({ parametros: esquemaIdEvaluacion }),
    controlador.obtenerResultado,
  );
  router.get(
    '/:id/revision',
    validar({ parametros: esquemaIdEvaluacion }),
    controlador.obtenerRevision,
  );
  router.post(
    '/:id/items/:item/respuesta',
    validar({ parametros: esquemaIdsItem, cuerpo: esquemaRespuesta }),
    controlador.responderPregunta,
  );
  return router;
}
