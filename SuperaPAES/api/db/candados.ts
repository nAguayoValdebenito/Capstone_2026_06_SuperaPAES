// Candados de sesión de PostgreSQL (pg_try_advisory_lock) para que un trabajo lo haga un solo proceso a la
// vez, por ejemplo un lote de generación con IA. El candado vive en la conexión que lo tomó: por eso se usa un
// cliente dedicado (no el pool compartido) que se devuelve siempre en el finally. Si el proceso muere, la base
// suelta el candado al cerrarse la conexión.
import type { Ejecutor } from './transaccion.js';

interface FuenteDeClientes {
  connect(): Promise<Ejecutor & { release(error?: Error | boolean): void }>;
}

export type ResultadoConCandado<T> = { tomado: true; valor: T } | { tomado: false };

export interface CandadosDeSesion {
  /**
   * Ejecuta `trabajo` solo si nadie más tiene el candado de `clave`; si lo tiene otro proceso, no espera y
   * devuelve `tomado: false`. El candado se suelta siempre al terminar, también si el trabajo falla.
   */
  conCandado<T>(clave: bigint, trabajo: () => Promise<T>): Promise<ResultadoConCandado<T>>;
}

/** Candados sobre un pool real: toma un cliente propio por candado. */
export function crearCandadosDeSesion(fuente: FuenteDeClientes): CandadosDeSesion {
  return {
    async conCandado(clave, trabajo) {
      const cliente = await fuente.connect();
      let conexionRota = false;
      try {
        const { rows } = await cliente.query<{ tomado: boolean }>(
          'SELECT pg_try_advisory_lock($1::bigint) AS tomado',
          [clave.toString()],
        );
        if (rows[0]?.tomado !== true) return { tomado: false };
        try {
          return { tomado: true, valor: await trabajo() };
        } finally {
          await cliente
            .query('SELECT pg_advisory_unlock($1::bigint)', [clave.toString()])
            .catch(() => {
              // Si no se pudo soltar, la conexión se descarta: al cerrarse, la base libera el candado.
              conexionRota = true;
            });
        }
      } finally {
        cliente.release(conexionRota);
      }
    },
  };
}

/** Candados que siempre se obtienen: para las pruebas que no usan una base real. */
export const candadosSinBase: CandadosDeSesion = {
  async conCandado(_clave, trabajo) {
    return { tomado: true, valor: await trabajo() };
  },
};
