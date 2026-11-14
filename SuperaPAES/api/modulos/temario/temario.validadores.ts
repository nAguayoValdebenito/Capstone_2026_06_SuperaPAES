// Esquemas zod de entrada del módulo temario. Se usan con validar() en las rutas.
import { z } from 'zod';

/** HU-30: ?curso= de las opciones de práctica, con el código de contenido.nivel_escolar (3M, EG). */
export const esquemaOpcionesPractica = z.strictObject({
  curso: z
    .string()
    .trim()
    .regex(/^[0-9A-Z]{1,4}$/, 'Indica el código de tu curso.'),
});

export type DatosOpcionesPractica = z.output<typeof esquemaOpcionesPractica>;

/** Un porcentaje de la mezcla: entero de 0 a 100 (contenido.dificultad, RN-09). */
const porcentaje = (campo: string) =>
  z
    .number(`Indica el ${campo} como un número.`)
    .int(`El ${campo} debe ser un número entero.`)
    .min(0, `El ${campo} va de 0 a 100.`)
    .max(100, `El ${campo} va de 0 a 100.`);

/**
 * C09 / RF-C12 / RN-09: la mezcla global de las dificultades, por su código. El servicio revisa que
 * vengan todas las existentes y las reglas entre los números (orden y sumas).
 */
export const esquemaMezclaDificultad = z.strictObject({
  dificultades: z
    .array(
      z.strictObject({
        codigo: z.string().regex(/^[a-z_]{1,10}$/, 'El código no es válido.'),
        minimo: porcentaje('mínimo'),
        objetivo: porcentaje('objetivo'),
        maximo: porcentaje('máximo'),
      }),
      'Envía la lista de dificultades.',
    )
    .min(1, 'Envía la lista de dificultades.')
    .max(10, 'Hay demasiadas dificultades.'),
});

export type DatosMezclaDificultad = z.output<typeof esquemaMezclaDificultad>;
