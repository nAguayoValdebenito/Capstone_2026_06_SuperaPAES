// Esquemas zod de entrada del módulo preguntas. Se usan con validar() en las rutas.
import { z } from 'zod';
import { idDeCuerpo, idDeRuta } from '../../comun/identificadores.js';

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

/** Letras de las alternativas, en orden (contenido.alternativa.letra). */
export const LETRAS = ['A', 'B', 'C', 'D', 'E'] as const;

const textoObligatorio = (falta: string) => z.string().trim().min(1, falta);

/** Código de una lista de opciones (tipo_pregunta, dificultad: VARCHAR(20) o menos). */
const codigoDeLista = z.string().regex(/^[a-z_]{1,20}$/, 'El código no es válido.');

const alternativa = z.strictObject({
  letra: z.enum(LETRAS, 'La letra debe ser de la A a la E.'),
  texto: textoObligatorio('Escribe el texto de la alternativa.'),
  esCorrecta: z.boolean('Indica si la alternativa es la correcta.'),
  /** Explicación de por qué la alternativa es correcta o no; opcional en las preguntas manuales. */
  explicacion: z.string().trim().nullable().default(null),
});

/**
 * HU-12, RF-G02 y C03: datos de una pregunta al crearla o editarla. El tipo de pregunta y la dificultad
 * sugerida van por su código. El texto de lectura (texto_estimulo) y el orden de la pregunta en él van
 * juntos, como exige el modelo. RN-08 (cuántas alternativas, una correcta y el texto en Competencia
 * Lectora) depende de la prueba: lo revisa el servicio.
 */
export const esquemaPregunta = z
  .strictObject({
    pruebaId: idDeCuerpo,
    contenidoId: idDeCuerpo,
    habilidadId: idDeCuerpo,
    tipoPregunta: codigoDeLista,
    dificultadSugerida: codigoDeLista.nullable().default(null),
    enunciado: textoObligatorio('Escribe el enunciado.'),
    explicacion: textoObligatorio('Escribe la explicación de la respuesta correcta.'),
    textoEstimuloId: idDeCuerpo.nullable().default(null),
    ordenEnTexto: z.int().positive().max(32_767).nullable().default(null),
    alternativas: z.array(alternativa).min(1, 'Agrega las alternativas.').max(LETRAS.length),
  })
  .refine((datos) => (datos.textoEstimuloId === null) === (datos.ordenEnTexto === null), {
    message: 'Indica el texto de lectura y el orden de la pregunta en él.',
    path: ['ordenEnTexto'],
  });

export const esquemaIdPregunta = z.strictObject({ id: idDeRuta });

export type DatosPregunta = z.output<typeof esquemaPregunta>;
export type AlternativaPregunta = DatosPregunta['alternativas'][number];
