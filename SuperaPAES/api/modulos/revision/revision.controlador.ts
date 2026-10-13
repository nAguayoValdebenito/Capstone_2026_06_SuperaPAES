// Controlador del módulo revision: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores.
import type { RevisionServicio } from './revision.servicio.js';

export type RevisionControlador = Record<string, never>;

export function crearRevisionControlador(_servicio: RevisionServicio): RevisionControlador {
  return {};
}
