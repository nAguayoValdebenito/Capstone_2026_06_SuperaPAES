// Lo común de las llamadas a las tiendas (HU-43.1): una tienda caída, lenta o con una respuesta que no
// se entiende es una tienda no disponible (503) y la suscripción queda igual. El registro guarda solo la
// tienda, la causa y el estado HTTP: nunca la compra, la llave ni el token.
import type { z } from 'zod';
import { ErrorTiendaNoDisponible } from '../../comun/errores.js';
import { registro } from '../../comun/registro.js';
import type { ClienteHttp, PeticionHttp, RespuestaHttp } from './http.js';
import type { Tienda } from './pasarela.js';

const NOMBRE_TIENDA: Record<Tienda, string> = {
  google_play: 'Google Play',
  app_store: 'La App Store',
};

/** Registra la causa (sin datos de la compra ni secretos) y crea el 503 TIENDA_NO_DISPONIBLE. */
export function noDisponible(
  tienda: Tienda,
  causa: string,
  campos: Record<string, unknown> = {},
): ErrorTiendaNoDisponible {
  registro.error(`${NOMBRE_TIENDA[tienda]} no disponible: ${causa}`, { tienda, ...campos });
  return new ErrorTiendaNoDisponible();
}

/** El cuerpo JSON de la respuesta con la forma esperada, o 503. */
export function leerJson<T>(
  tienda: Tienda,
  respuesta: RespuestaHttp,
  esquema: z.ZodType<T>,
  que: string,
): T {
  let datos: unknown;
  try {
    datos = JSON.parse(respuesta.cuerpo);
  } catch {
    throw noDisponible(tienda, `${que} no es JSON`);
  }
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) throw noDisponible(tienda, `${que} no tiene la forma esperada`);
  return resultado.data;
}

/** Una red caída o una tienda que tarda más del tiempo límite es una tienda no disponible. */
export async function pedirATienda(
  tienda: Tienda,
  http: ClienteHttp,
  peticion: PeticionHttp,
): Promise<RespuestaHttp> {
  try {
    return await http(peticion);
  } catch (error) {
    throw noDisponible(tienda, 'no respondió', {
      error: error instanceof Error ? error.name : 'otro',
    });
  }
}
