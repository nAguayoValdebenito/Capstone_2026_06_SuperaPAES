// Esquemas zod de entrada del módulo revision. Se usan con validar() en las rutas.
import { z } from 'zod';
import { idDeRuta } from '../../comun/identificadores.js';
import { GRUPOS_SEGUIMIENTO } from './revision.reglas.js';

/** HU-21: la pregunta que se envía a revisión. */
export const esquemaIdPregunta = z.strictObject({ id: idDeRuta });

/** HU-22 y HU-23: la revisión o el desempate (la asignación) que abre o entrega el docente. */
export const esquemaIdRevision = z.strictObject({ id: idDeRuta });

const POR_PAGINA_SEGUIMIENTO = 20;

/** C06: el grupo que se mira y la página. */
export const esquemaConsultaSeguimiento = z.strictObject({
  grupo: z.enum(GRUPOS_SEGUIMIENTO).default('en_curso'),
  pagina: z.coerce.number().int().min(1).max(100_000).default(1),
  porPagina: z.coerce.number().int().min(1).max(50).default(POR_PAGINA_SEGUIMIENTO),
});

export type ConsultaSeguimientoHttp = z.output<typeof esquemaConsultaSeguimiento>;

/** Código de una lista de opciones (criterio_pauta, dificultad, decision_revision). */
const codigo = z.string().regex(/^[a-z_]{1,30}$/, 'El código no es válido.');

const textoOpcional = (maximo: number, mensaje: string) =>
  z
    .string()
    .trim()
    .max(maximo, mensaje)
    .transform((valor) => valor || null)
    .nullable()
    .default(null);

/**
 * HU-22 y CU-19 (pasos 3 a 5): cada punto de la pauta (si se cumple y, cuando no, la observación), la
 * dificultad que asigna el docente y su decisión, con el motivo al observar o rechazar. Que estén todos
 * los puntos, la observación de cada «no» y el motivo según la decisión lo revisa el servicio.
 */
export const esquemaRevision = z.strictObject({
  criterios: z
    .array(
      z.strictObject({
        codigo,
        cumple: z.boolean('Indica si se cumple.'),
        observacion: textoOpcional(300, 'La observación puede tener hasta 300 caracteres.'),
      }),
    )
    .max(30),
  dificultad: codigo,
  decision: codigo,
  comentario: textoOpcional(2000, 'El motivo puede tener hasta 2.000 caracteres.'),
});

export type DatosRevision = z.output<typeof esquemaRevision>;

/**
 * HU-23 y CU-20 (D02): la dificultad final y la decisión del tercer docente, con el motivo al observar o
 * rechazar. Sin pauta: decide entre las dos revisiones, que ve completas.
 */
export const esquemaDesempate = esquemaRevision.omit({ criterios: true });

export type DatosDesempate = z.output<typeof esquemaDesempate>;

/** HU-25 (D03): saltar pide la siguiente después de esa asignación. */
export const esquemaConsultaClasificacion = z.strictObject({ despuesDe: idDeRuta.optional() });

export type ConsultaClasificacionHttp = z.output<typeof esquemaConsultaClasificacion>;

/**
 * HU-25 y CU-19a (D03): solo la dificultad. La decisión (aprobar) y la pauta (cumplida) las pone el
 * servicio; que la dificultad exista lo revisa el servicio.
 */
export const esquemaClasificacion = esquemaDesempate.pick({ dificultad: true });

export type DatosClasificacion = z.output<typeof esquemaClasificacion>;

/** HU-26.1 (D04): el docente confirma que la dificultad no corresponde (false) o la descarta (true). */
export const esquemaCalibracion = z.strictObject({
  dificultadCorresponde: z.boolean('Indica si la dificultad corresponde.'),
});

export type DatosCalibracion = z.output<typeof esquemaCalibracion>;
