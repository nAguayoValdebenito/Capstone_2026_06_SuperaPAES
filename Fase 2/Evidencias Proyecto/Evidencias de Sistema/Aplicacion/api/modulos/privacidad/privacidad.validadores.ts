// Esquemas zod de entrada del módulo privacidad. Se usan con validar() en las rutas.
import { z } from 'zod';
import { numeroDePagina } from '../../comun/consultas.js';
import { idDeRuta } from '../../comun/identificadores.js';

/**
 * Largo máximo del detalle y de la respuesta de una solicitud (plan HU-55, D2: el DAS no fija uno;
 * RNF-02 pide validar toda entrada).
 */
export const LARGO_MAXIMO_DETALLE = 2000;

/** Filas por página de la bandeja de la consola, como las demás bandejas, y su máximo. */
const POR_PAGINA = 20;
const MAXIMO_POR_PAGINA = 100;

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

/**
 * Bandeja de la consola (C14, HU-55 esc. 1): por defecto las pendientes. Los estados son los códigos de
 * contenido.estado_solicitud.
 */
export const esquemaFiltrosSolicitudes = z.strictObject({
  estado: z
    .enum(
      ['pendiente', 'respondida', 'rechazada'],
      'El estado debe ser pendiente, respondida o rechazada.',
    )
    .default('pendiente'),
  pagina: numeroDePagina(1, 100_000),
  porPagina: numeroDePagina(POR_PAGINA, MAXIMO_POR_PAGINA),
});

export const esquemaIdSolicitud = z.strictObject({ id: idDeRuta });

/** HU-55 esc. 2: se responde o se rechaza, siempre con un texto. */
export const esquemaAtencionSolicitud = z.strictObject({
  estado: z.enum(['respondida', 'rechazada'], 'La solicitud se responde o se rechaza.'),
  respuesta: z
    .string('Escribe la respuesta al estudiante.')
    .trim()
    .min(1, 'Escribe la respuesta al estudiante.')
    .max(
      LARGO_MAXIMO_DETALLE,
      `La respuesta puede tener hasta ${String(LARGO_MAXIMO_DETALLE)} caracteres.`,
    ),
});

export type FiltrosSolicitudes = z.output<typeof esquemaFiltrosSolicitudes>;
export type DatosAtencionSolicitud = z.output<typeof esquemaAtencionSolicitud>;
