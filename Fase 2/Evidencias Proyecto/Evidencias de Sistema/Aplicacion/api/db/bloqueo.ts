// Bloqueo de PostgreSQL (advisory lock) para que dos procesos no corran a la vez el mismo script
// (migraciones o semillas).
import { mensajeDeError, registro } from '../comun/registro.js';
import type { Ejecutor } from './transaccion.js';

/**
 * Toma el bloqueo `clave`, ejecuta el trabajo y lo libera. El bloqueo se libera solo al cerrar la
 * sesión; si liberarlo falla, se registra sin ocultar el resultado ni el error del trabajo.
 */
export async function conBloqueo<T>(
  cliente: Ejecutor,
  clave: number,
  trabajo: () => Promise<T>,
): Promise<T> {
  await cliente.query('SELECT pg_advisory_lock($1)', [clave]);
  try {
    return await trabajo();
  } finally {
    await cliente.query('SELECT pg_advisory_unlock($1)', [clave]).catch((falla: unknown) => {
      registro.error('No se pudo liberar el bloqueo de la base', { error: mensajeDeError(falla) });
    });
  }
}
