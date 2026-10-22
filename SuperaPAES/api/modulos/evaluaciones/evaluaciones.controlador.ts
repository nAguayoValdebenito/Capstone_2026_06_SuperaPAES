// Controlador del módulo evaluaciones: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores.
import type { EvaluacionesServicio } from './evaluaciones.servicio.js';

export type EvaluacionesControlador = Record<string, never>;

export function crearEvaluacionesControlador(
  _servicio: EvaluacionesServicio,
): EvaluacionesControlador {
  return {};
}
