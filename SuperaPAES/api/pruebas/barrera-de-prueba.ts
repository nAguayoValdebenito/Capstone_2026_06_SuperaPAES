// Barrera para las pruebas de concurrencia con PostgreSQL: envuelve la unidad de trabajo para que las
// transacciones que llegan a una consulta (la que reconoce `punto`) esperen a que lleguen todas las
// demás antes de ejecutarla. Así el cruce de las peticiones no depende de la suerte del planificador:
// todas ya hicieron sus lecturas cuando cualquiera escribe. Solo las primeras `participantes` llegadas
// esperan; las siguientes (por ejemplo, un reintento) pasan sin esperar.
import type { Ejecutor, UnidadDeTrabajo } from '../db/transaccion.js';

export function conBarrera(
  real: UnidadDeTrabajo,
  punto: RegExp,
  participantes = 2,
): UnidadDeTrabajo {
  let llegadas = 0;
  let abrir: () => void = () => undefined;
  const puerta = new Promise<void>((resolver) => {
    abrir = resolver;
  });
  const esperar = (): Promise<void> => {
    llegadas += 1;
    if (llegadas === participantes) abrir();
    return llegadas <= participantes ? puerta : Promise.resolve();
  };
  return {
    enTransaccion: (trabajo) =>
      real.enTransaccion((tx) => {
        const query = (async (...argumentos: unknown[]) => {
          const [consulta] = argumentos;
          const texto =
            typeof consulta === 'string' ? consulta : ((consulta as { text?: string }).text ?? '');
          if (punto.test(texto)) await esperar();
          return (tx.query as (...a: unknown[]) => Promise<unknown>)(...argumentos);
        }) as Ejecutor['query'];
        return trabajo({ query });
      }),
  };
}
