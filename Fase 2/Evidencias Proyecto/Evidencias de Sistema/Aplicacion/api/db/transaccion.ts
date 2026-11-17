// Unidad de trabajo: las operaciones que cambian varias tablas, incluso de módulos distintos,
// ocurren en una sola transacción. COMMIT si todo termina bien, ROLLBACK si algo falla.
import type pg from 'pg';
import { mensajeDeError, registro } from '../comun/registro.js';

/**
 * Lo que necesita un repositorio para consultar: el pool o el cliente de una transacción.
 * Los métodos de los repositorios reciben un `Ejecutor` opcional para sumarse a la transacción en curso.
 */
export type Ejecutor = Pick<pg.ClientBase, 'query'>;

export interface UnidadDeTrabajo {
  /** Ejecuta el trabajo en una transacción y entrega `tx` para pasarlo a servicios y repositorios. */
  enTransaccion<T>(trabajo: (tx: Ejecutor) => Promise<T>): Promise<T>;
}

/** Transacción sobre un cliente ya conectado (por ejemplo, el de los scripts de migración). */
export async function ejecutarEnTransaccion<T>(
  cliente: Ejecutor,
  trabajo: (tx: Ejecutor) => Promise<T>,
): Promise<T> {
  await cliente.query('BEGIN');
  try {
    const resultado = await trabajo(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    // Si la conexión se cayó, el ROLLBACK también falla: se registra y se conserva el error original.
    await cliente.query('ROLLBACK').catch((falla: unknown) => {
      registro.error('Falló el ROLLBACK', { error: mensajeDeError(falla) });
    });
    throw error;
  }
}

interface FuenteDeClientes {
  connect(): Promise<Ejecutor & { release(): void }>;
}

/** Unidad de trabajo sobre el pool: toma un cliente por transacción y lo devuelve al terminar. */
export function crearUnidadDeTrabajo(pool: FuenteDeClientes): UnidadDeTrabajo {
  return {
    async enTransaccion(trabajo) {
      const cliente = await pool.connect();
      try {
        return await ejecutarEnTransaccion(cliente, trabajo);
      } finally {
        cliente.release();
      }
    },
  };
}
