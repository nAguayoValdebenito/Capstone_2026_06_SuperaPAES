// Contrato HTTP de identificadores: los cuerpos usan números y las rutas convierten su segmento.
import { z } from 'zod';

const MAXIMO_ID = Number.MAX_SAFE_INTEGER;
const MAXIMO_ID_GRANDE = BigInt(MAXIMO_ID);

/** Id de un campo JSON. No admite cadenas, decimales, cero ni números imprecisos. */
export const idDeCuerpo = z.number().int().positive().max(MAXIMO_ID);

/** El segmento de una URL es texto por HTTP; tras validarlo, el controlador recibe un número. */
export const idDeRuta = z
  .string()
  .regex(/^[1-9]\d{0,15}$/, 'El identificador no es válido.')
  .refine(
    (valor) => /^[1-9]\d{0,15}$/.test(valor) && BigInt(valor) <= MAXIMO_ID_GRANDE,
    'El identificador no es válido.',
  )
  .transform(Number);
