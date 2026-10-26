// Reintento del inicio de una práctica cuando dos inicios del mismo estudiante se cruzan (RN-19).
//
// Por qué ocurre: la segunda transacción espera el bloqueo de app.estudiante y, cuando lo obtiene,
// cierra como abandonada la práctica que acaba de crear la primera. app.cerrar_evaluacion pone
// cerrada_en = now(), y en PostgreSQL now() es la hora en que EMPEZÓ la transacción, no la hora actual.
// Si la segunda transacción empezó antes que la primera, cerrada_en quedaría antes que iniciada_en y la
// base rechaza el cierre con la restricción evaluacion_check2.
//
// Repetir la transacción completa lo resuelve: la anterior ya se deshizo entera (ROLLBACK de la unidad
// de trabajo, sin nada a medias) y la nueva empieza después, con un now() posterior. Solo se reintenta
// ese rechazo, reconocido por su código y su restricción; cualquier otro error sigue su camino.

/** CHECK (cerrada_en IS NULL OR cerrada_en >= iniciada_en) de app.evaluacion. */
const RESTRICCION_CIERRE_ANTES_DEL_INICIO = 'evaluacion_check2';
/** check_violation de PostgreSQL. */
const VIOLACION_DE_CHECK = '23514';
/** Reintentos después del primer intento. */
export const REINTENTOS_INICIO = 2;

function cierreAntesDelInicio(error: unknown): boolean {
  const { code, constraint } = (error ?? {}) as { code?: unknown; constraint?: unknown };
  return code === VIOLACION_DE_CHECK && constraint === RESTRICCION_CIERRE_ANTES_DEL_INICIO;
}

/** Ejecuta la transacción del inicio y la repite hasta REINTENTOS_INICIO veces, solo ante ese rechazo. */
export async function conReintentoDeInicio<T>(transaccion: () => Promise<T>): Promise<T> {
  for (let intento = 0; ; intento++) {
    try {
      return await transaccion();
    } catch (error) {
      if (intento >= REINTENTOS_INICIO || !cierreAntesDelInicio(error)) throw error;
    }
  }
}
