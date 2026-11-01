// Cliente HTTP falso para las pruebas de las pasarelas de pago: guarda cada petición y responde según
// la URL, con la respuesta simulada de la tienda o con un error de red.
import type { ClienteHttp, PeticionHttp } from '../adaptadores/pagos/http.js';

export type RespuestaFalsa = { estado: number; cuerpo: unknown } | Error;

export function httpFalso(respuestas: Record<string, RespuestaFalsa | RespuestaFalsa[]>) {
  const peticiones: PeticionHttp[] = [];
  const cliente: ClienteHttp = (peticion) => {
    peticiones.push(peticion);
    const definida = respuestas[peticion.url];
    const respuesta = Array.isArray(definida) ? definida.shift() : definida;
    if (!respuesta) return Promise.reject(new Error(`Sin respuesta para ${peticion.url}`));
    if (respuesta instanceof Error) return Promise.reject(respuesta);
    return Promise.resolve({
      estado: respuesta.estado,
      cuerpo:
        typeof respuesta.cuerpo === 'string' ? respuesta.cuerpo : JSON.stringify(respuesta.cuerpo),
    });
  };
  return { cliente, peticiones };
}

/** `detalles.motivo` de un ErrorCompraNoValida. */
export const motivoDe = (error: unknown) =>
  (error as { detalles?: { motivo?: string } }).detalles?.motivo;
