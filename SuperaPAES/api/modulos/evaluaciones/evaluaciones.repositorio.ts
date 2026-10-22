// Único lugar con SQL del módulo evaluaciones. Consultas siempre parametrizadas ($1, $2...).
// Tablas que pertenecen a este módulo (ningún otro módulo las escribe):
//   - app.evaluacion
//   - app.evaluacion_item
//   - app.resultado_evaluacion, app.resultado_eje y app.resultado_habilidad (los calcula la base al cerrar)
//   - app.estadistica_pregunta
//   - contenido.estructura_evaluacion y contenido.estructura_detalle (reparto por eje, RN-35)
//   - contenido.tabla_conversion y contenido.tabla_conversion_fila (tablas del DEMRE, RN-23)
//   - funciones app.cerrar_evaluacion, app.cerrar_vencidas y app.calcular_resultado
//   - vista contenido.v_preguntas_publicadas
//   - vistas app.v_historial, app.v_revision_evaluacion y app.v_respuesta_valida
//   - vistas app.v_progreso_eje, app.v_progreso_habilidad, app.v_evolucion_semanal y app.v_preguntas_falladas
// Cada método recibe un Ejecutor opcional (tx) para sumarse a la transacción del servicio.
import type { Ejecutor } from '../../db/transaccion.js';

export type EvaluacionesRepositorio = Record<string, never>;

/** @esqueleto Lo usará el servicio del módulo cuando implemente su primera consulta. */
export function crearEvaluacionesRepositorio(_bd: Ejecutor): EvaluacionesRepositorio {
  return {};
}
