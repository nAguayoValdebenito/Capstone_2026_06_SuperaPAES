// Esquemas zod de la trazabilidad de suscripciones en la consola (HU-56, RF-C09). Se usan con validar()
// en las rutas de administración.
import { z } from 'zod';
import { codigoConsulta, idConsulta, numeroDePagina } from '../../comun/consultas.js';

/** Suscripciones y avisos por página: 20 por defecto (docs/convenciones.md), hasta 100. */
export const POR_PAGINA_SUSCRIPCIONES = 20;
const MAXIMO_POR_PAGINA = 100;

const paginacion = {
  pagina: numeroDePagina(1, 100_000),
  porPagina: numeroDePagina(POR_PAGINA_SUSCRIPCIONES, MAXIMO_POR_PAGINA),
};

const fecha = z.iso.date('La fecha debe tener el formato AAAA-MM-DD.');

/**
 * HU-56 esc. 2: filtros de la lista. Todos son opcionales y se combinan: estado por el código de su
 * lista de opciones (RN-26), plan por su id (SMALLINT), fechas de creación (ambas incluidas) y parte
 * del correo del estudiante.
 */
export const esquemaFiltrosSuscripciones = z
  .strictObject({
    estado: codigoConsulta.optional(),
    plan: idConsulta(32_767).optional(),
    desde: fecha.optional(),
    hasta: fecha.optional(),
    correo: z
      .string()
      .trim()
      .min(1)
      .max(150, 'El correo puede tener hasta 150 caracteres.')
      .optional(),
    ...paginacion,
  })
  .refine((f) => !f.desde || !f.hasta || f.desde <= f.hasta, {
    message: 'La fecha «Desde» no puede ser posterior a «Hasta».',
    path: ['hasta'],
  });

export type FiltrosSuscripciones = z.output<typeof esquemaFiltrosSuscripciones>;

/** HU-56 esc. 4: la página de la bandeja de avisos con error. */
export const esquemaConsultaAvisos = z.strictObject(paginacion);

export type ConsultaAvisos = z.output<typeof esquemaConsultaAvisos>;
