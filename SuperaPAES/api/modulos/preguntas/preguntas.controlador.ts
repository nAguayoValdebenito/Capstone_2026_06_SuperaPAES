// Controlador del módulo preguntas: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores.
import type { PreguntasServicio } from './preguntas.servicio.js';

export type PreguntasControlador = Record<string, never>;

export function crearPreguntasControlador(_servicio: PreguntasServicio): PreguntasControlador {
  return {};
}
