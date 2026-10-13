// Controlador del módulo administracion: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores.
import type { AdministracionServicio } from './administracion.servicio.js';

export type AdministracionControlador = Record<string, never>;

export function crearAdministracionControlador(
  _servicio: AdministracionServicio,
): AdministracionControlador {
  return {};
}
