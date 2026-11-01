// La ficha de cada pregunta de un lote (HU-16.2). Antes de llamar a la IA, el servidor reparte entre las
// preguntas del lote un subtema distinto del contenido, una habilidad, una dificultad (cuotas de RN-09), un
// tipo de contexto y, en pruebas numéricas, un resultado objetivo sugerido. Así la variedad no depende de que
// el modelo «se acuerde» de variar (con la misma instrucción, 2 de 5 enunciados salieron idénticos).

export type CodigoDificultad = 'facil' | 'media' | 'dificil';

export interface HabilidadDeFicha {
  codigo: string;
  nombre: string;
  criterios: string | null;
}

export interface Ficha {
  /** Posición de la pregunta en el lote, desde 1. */
  orden: number;
  subDescriptor: string;
  habilidad: HabilidadDeFicha;
  dificultad: CodigoDificultad;
  contexto: string;
  /** Respuesta correcta que se sugiere (solo pruebas numéricas); null si no se usa. */
  resultadoObjetivo: number | null;
}

export interface EntradaFichas {
  cantidad: number;
  nombreContenido: string;
  /** Texto de contenido.contenido_tematico.descriptores, con oraciones separadas por punto. */
  descriptores: string | null;
  habilidades: readonly HabilidadDeFicha[];
  /** Mezcla objetivo de dificultad en porcentaje (contenido.dificultad.mezcla_objetivo). */
  mezcla: Record<CodigoDificultad, number>;
  contextos: readonly string[];
  numerica: boolean;
  usarResultadoObjetivo: boolean;
  /** Número en [0, 1): se inyecta para poder repetir una prueba con la misma semilla. */
  aleatorio: () => number;
}

const LARGO_MAXIMO_SUBTEMA = 300;
const LARGO_MINIMO_SUBTEMA = 8;
/** Rango del resultado sugerido según la dificultad: más pasos, números más grandes. */
const RANGO_OBJETIVO: Record<CodigoDificultad, readonly [number, number]> = {
  facil: [2, 20],
  media: [5, 60],
  dificil: [10, 120],
};

/** Las oraciones del descriptor (2 a 4 por contenido); sin descriptores, el nombre del contenido. */
export function subDescriptores(descriptores: string | null, nombreContenido: string): string[] {
  const partes = (descriptores ?? '')
    .split(/(?<=[.!?])\s+/u)
    .map((parte) => parte.trim())
    .filter((parte) => parte.length >= LARGO_MINIMO_SUBTEMA)
    .map((parte) => parte.slice(0, LARGO_MAXIMO_SUBTEMA));
  return partes.length > 0 ? partes : [nombreContenido];
}

/**
 * RN-09: el piso de cada dificultad y lo que falta a los mayores restos. En un empate, media, fácil y
 * difícil, en ese orden.
 */
export function repartirDificultades(
  cantidad: number,
  mezcla: Record<CodigoDificultad, number>,
): Record<CodigoDificultad, number> {
  const orden = ['media', 'facil', 'dificil'] as const;
  const filas = orden.map((codigo) => {
    const exacto = (cantidad * mezcla[codigo]) / 100;
    return { codigo, exacto, n: Math.floor(exacto) };
  });
  let faltan = cantidad - filas.reduce((suma, fila) => suma + fila.n, 0);
  const porResto = [...filas].sort((a, b) => b.exacto - b.n - (a.exacto - a.n));
  for (const fila of porResto) {
    if (faltan <= 0) break;
    fila.n += 1;
    faltan -= 1;
  }
  return { facil: filas[1]!.n, media: filas[0]!.n, dificil: filas[2]!.n };
}

function barajar<T>(lista: readonly T[], aleatorio: () => number): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  }
  return copia;
}

/** Un entero del rango de la dificultad que todavía no se usó en el lote. */
function sortearObjetivo(
  dificultad: CodigoDificultad,
  usados: Set<number>,
  aleatorio: () => number,
): number {
  const [minimo, maximo] = RANGO_OBJETIVO[dificultad];
  let valor = minimo + Math.floor(aleatorio() * (maximo - minimo + 1));
  while (usados.has(valor)) valor += 1;
  usados.add(valor);
  return valor;
}

export function armarFichas(entrada: EntradaFichas): Ficha[] {
  const { aleatorio, cantidad } = entrada;
  const subtemas = barajar(
    subDescriptores(entrada.descriptores, entrada.nombreContenido),
    aleatorio,
  );
  const habilidades = barajar(entrada.habilidades, aleatorio);
  const contextos = barajar(entrada.contextos, aleatorio);
  const cuotas = repartirDificultades(cantidad, entrada.mezcla);
  const dificultades = barajar(
    [
      ...Array<CodigoDificultad>(cuotas.facil).fill('facil'),
      ...Array<CodigoDificultad>(cuotas.media).fill('media'),
      ...Array<CodigoDificultad>(cuotas.dificil).fill('dificil'),
    ],
    aleatorio,
  );
  const usados = new Set<number>();
  return dificultades.map((dificultad, i) => ({
    orden: i + 1,
    subDescriptor: subtemas[i % subtemas.length]!,
    habilidad: habilidades[i % habilidades.length]!,
    dificultad,
    contexto: contextos[i % contextos.length]!,
    resultadoObjetivo:
      entrada.numerica && entrada.usarResultadoObjetivo
        ? sortearObjetivo(dificultad, usados, aleatorio)
        : null,
  }));
}
