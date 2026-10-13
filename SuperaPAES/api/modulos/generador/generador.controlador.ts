// Controlador del módulo generador: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores.
import type { GeneradorServicio } from './generador.servicio.js';

export type GeneradorControlador = Record<string, never>;

export function crearGeneradorControlador(_servicio: GeneradorServicio): GeneradorControlador {
  return {};
}
