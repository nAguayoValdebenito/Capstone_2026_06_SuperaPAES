// Esquemas zod de entrada del módulo privacidad. Se usan con validar() en las rutas.
import { z } from 'zod';

/** Largo máximo del detalle de una solicitud (plan HU-55, D2: el DAS no fija uno; RNF-02 pide validar). */
export const LARGO_MAXIMO_DETALLE = 2000;

/**
 * HU-09.1 (RF-A21): el código del derecho y, si el estudiante lo explica, el detalle. El detalle es
 * opcional, como en el modelo 11.0: sin texto (o solo con espacios) se guarda vacío. Que el código
 * exista en contenido.tipo_derecho lo comprueba el servicio.
 */
export const esquemaNuevaSolicitud = z.strictObject({
  tipo: z
    .string('Elige un tipo de solicitud.')
    .trim()
    .min(1, 'Elige un tipo de solicitud.')
    .max(15, 'Elige un tipo de solicitud válido.'),
  detalle: z
    .string('El detalle debe ser un texto.')
    .trim()
    .max(
      LARGO_MAXIMO_DETALLE,
      `El detalle puede tener hasta ${String(LARGO_MAXIMO_DETALLE)} caracteres.`,
    )
    .nullish()
    .transform((valor) => (valor ? valor : null)),
});

export type DatosNuevaSolicitud = z.output<typeof esquemaNuevaSolicitud>;
