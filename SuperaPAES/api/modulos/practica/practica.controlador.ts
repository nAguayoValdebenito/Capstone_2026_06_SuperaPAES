// Controlador del módulo practica: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores.
import type { PracticaServicio } from './practica.servicio.js';

export type PracticaControlador = Record<string, never>;

export function crearPracticaControlador(_servicio: PracticaServicio): PracticaControlador {
  return {};
}
