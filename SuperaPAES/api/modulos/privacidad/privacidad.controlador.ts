// Controlador del módulo privacidad: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores.
import type { PrivacidadServicio } from './privacidad.servicio.js';

export type PrivacidadControlador = Record<string, never>;

export function crearPrivacidadControlador(_servicio: PrivacidadServicio): PrivacidadControlador {
  return {};
}
