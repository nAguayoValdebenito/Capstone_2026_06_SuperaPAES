// Controlador del módulo temario: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores.
import type { TemarioServicio } from './temario.servicio.js';

export type TemarioControlador = Record<string, never>;

export function crearTemarioControlador(_servicio: TemarioServicio): TemarioControlador {
  return {};
}
