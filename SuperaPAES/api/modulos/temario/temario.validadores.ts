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
