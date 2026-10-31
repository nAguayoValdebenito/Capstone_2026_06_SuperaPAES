// Cliente HTTP de las pasarelas de pago: una función inyectable para que las pruebas respondan como la
// tienda sin salir a la red. Cada petición tiene un tiempo límite (10 s por defecto): una tienda lenta
// se trata como no disponible y la suscripción queda igual.
export interface PeticionHttp {
  metodo: 'GET' | 'POST';
  url: string;
  encabezados?: Record<string, string>;
  cuerpo?: string;
  tiempoLimiteMs?: number;
}

export interface RespuestaHttp {
  estado: number;
  cuerpo: string;
}

export type ClienteHttp = (peticion: PeticionHttp) => Promise<RespuestaHttp>;

export const TIEMPO_LIMITE_TIENDA_MS = 10_000;

/** Cliente real sobre fetch de Node. Falla (rechaza) si la red falla o se cumple el tiempo límite. */
export const clienteHttpFetch: ClienteHttp = async (peticion) => {
  const respuesta = await fetch(peticion.url, {
    method: peticion.metodo,
    headers: peticion.encabezados ?? {},
    ...(peticion.cuerpo !== undefined && { body: peticion.cuerpo }),
    signal: AbortSignal.timeout(peticion.tiempoLimiteMs ?? TIEMPO_LIMITE_TIENDA_MS),
  });
  return { estado: respuesta.status, cuerpo: await respuesta.text() };
};
