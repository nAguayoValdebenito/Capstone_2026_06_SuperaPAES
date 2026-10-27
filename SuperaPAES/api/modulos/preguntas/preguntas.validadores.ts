// Esquemas zod de entrada del módulo preguntas. Se usan con validar() en las rutas.
import { z } from 'zod';

/** Preguntas por página del banco: 20 por defecto (docs/convenciones.md), hasta 100. */
export const POR_PAGINA_BANCO = 20;
export const MAXIMO_POR_PAGINA_BANCO = 100;

/**
 * Origen de una pregunta. El modelo no lo guarda: se deduce del lote de IA o de la importación, como
 * en la vista contenido.v_calidad_criterio.
 */
export const ORIGENES_PREGUNTA = ['manual', 'importacion', 'ia'] as const;
export type OrigenPregunta = (typeof ORIGENES_PREGUNTA)[number];

/** Id de la consulta (?prueba=3): un entero positivo escrito como texto. */
const idConsulta = (maximo: number) =>
  z
    .string()
    .regex(/^[1-9]\d{0,9}$/, 'El identificador no es válido.')
    .transform(Number)
    .pipe(z.number().max(maximo, 'El identificador no es válido.'));

/** Código de una lista de opciones (estado_pregunta, dificultad); el servicio comprueba que exista. */
const codigoConsulta = z.string().regex(/^[a-z_]{1,15}$/, 'El código no es válido.');

const numeroDePagina = (porDefecto: number, maximo: number) =>
  z
    .string()
    .regex(/^[1-9]\d{0,5}$/, 'Debe ser un número entero positivo.')
    .transform(Number)
    .pipe(z.number().max(maximo, `Puede ser hasta ${String(maximo)}.`))
    .default(porDefecto);

/**
 * HU-11 y RF-G01: filtros del banco. Todos son opcionales y se combinan. prueba (SMALLINT), eje
 * (SMALLINT), contenido (INTEGER) y habilidad (SMALLINT, filtro de C02) van por id; estado y
 * dificultad por el código de su lista de opciones. La dificultad es la asignada por los docentes, la
 * que se exige para publicar.
 */
export const esquemaFiltrosBanco = z.strictObject({
  prueba: idConsulta(32_767).optional(),
  eje: idConsulta(32_767).optional(),
  contenido: idConsulta(2_147_483_647).optional(),
  habilidad: idConsulta(32_767).optional(),
  estado: codigoConsulta.optional(),
  origen: z.enum(ORIGENES_PREGUNTA, 'El origen debe ser manual, importacion o ia.').optional(),
  dificultad: codigoConsulta.optional(),
  pagina: numeroDePagina(1, 100_000),
  porPagina: numeroDePagina(POR_PAGINA_BANCO, MAXIMO_POR_PAGINA_BANCO),
});

export type FiltrosBanco = z.output<typeof esquemaFiltrosBanco>;
