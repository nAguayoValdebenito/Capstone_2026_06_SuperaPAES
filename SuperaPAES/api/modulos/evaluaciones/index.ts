// Módulo evaluaciones: evaluaciones (práctica, repaso, diagnóstico, mini-ensayo y ensayo completo),
// respuestas corregidas por la base, resultados, estadísticas y progreso.
// Incluye la estructura de cada evaluación (reparto por eje) y las tablas de conversión del DEMRE.
// Exporta solo sus rutas y su servicio: los demás módulos lo usan a través del servicio.
export { crearRutasAppEvaluaciones } from './evaluaciones.rutas.app.js';
export { crearEvaluacionesServicio, type EvaluacionesServicio } from './evaluaciones.servicio.js';
