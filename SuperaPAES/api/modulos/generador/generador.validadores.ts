// Esquemas zod de entrada del módulo generador. Se usan con validar() en las rutas.
import { z } from 'zod';
import { idDeRuta } from '../../comun/identificadores.js';

/** Tope de forma: el máximo real sale de max_preguntas_lote (contenido.configuracion) y lo aplica el servicio. */
const MAXIMO_DE_FORMA = 100;
const POR_PAGINA = 20;
const MAXIMO_POR_PAGINA = 50;

/** POST /admin/generador/lotes (HU-16 esc. 1): el contenido, la cantidad y, en Competencia Lectora, el texto. */
export const esquemaNuevoLote = z.strictObject({
  contenidoId: z.number().int().positive().max(2_147_483_647),
  cantidad: z.number().int().min(1).max(MAXIMO_DE_FORMA),
  conTexto: z.boolean().default(false),
});

export const esquemaIdLote = z.object({ id: idDeRuta });

const numero = (porDefecto: number, maximo: number) =>
  z
    .string()
    .regex(/^[1-9]\d{0,5}$/, 'Debe ser un número entero positivo.')
    .transform(Number)
    .pipe(z.number().max(maximo, `Puede ser hasta ${String(maximo)}.`))
    .default(porDefecto);

export const esquemaConsultaLotes = z.strictObject({
  pagina: numero(1, 100_000),
  porPagina: numero(POR_PAGINA, MAXIMO_POR_PAGINA),
});

export type ConsultaLotes = z.infer<typeof esquemaConsultaLotes>;
