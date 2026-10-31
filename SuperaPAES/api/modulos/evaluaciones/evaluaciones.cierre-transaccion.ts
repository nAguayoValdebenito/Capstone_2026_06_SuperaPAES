import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';

/** La función SQL usa now(): renovar la transacción evita cerrar antes de vence_en tras una espera. */
export class RelojDeCierreAntiguo extends Error {}

export async function conTransaccionDeCierre<T>(
  unidad: UnidadDeTrabajo,
  accion: (tx: Ejecutor) => Promise<T>,
): Promise<T> {
  try {
    return await unidad.enTransaccion(accion);
  } catch (error) {
    if (!(error instanceof RelojDeCierreAntiguo)) throw error;
    // La primera transacción se deshizo; la nueva empieza después del vencimiento observado.
    return unidad.enTransaccion(accion);
  }
}
