// Middleware que app.ts entrega a las rutas de los módulos que lo necesitan.
// Orden de la cadena en cada endpoint: autenticar → autorizar rol → validar entrada → limitar intentos.
import type { Autenticacion } from './autenticacion.js';
import type { CrearLimiteIntentos } from './limite-intentos.js';

export interface MiddlewareRutas extends Autenticacion {
  crearLimiteIntentos: CrearLimiteIntentos;
}
