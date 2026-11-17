import type {
  CodigoDificultad,
  CuotasDificultad,
  ObjetivoDificultad,
} from './evaluaciones.seleccion.tipos.js';

const DESEMPATE: Record<CodigoDificultad, number> = { media: 0, facil: 1, dificil: 2 };

/** RN-09: mayores restos con aritmética entera; la mezcla la entrega contenido.dificultad. */
export function calcularCuotas(
  cantidad: number,
  mezcla: readonly ObjetivoDificultad[],
): CuotasDificultad {
  if (!Number.isSafeInteger(cantidad) || cantidad < 0 || !Number.isSafeInteger(cantidad * 100)) {
    throw new Error('La cantidad debe ser un entero no negativo calculable sin perder precisión.');
  }
  comprobarMezcla(mezcla);
  const cuotas: CuotasDificultad = { facil: 0, media: 0, dificil: 0 };
  const restos = mezcla.map(({ codigo, objetivo }) => {
    const producto = cantidad * objetivo;
    cuotas[codigo] = Math.floor(producto / 100);
    return { codigo, resto: producto % 100 };
  });
  restos.sort((a, b) => b.resto - a.resto || DESEMPATE[a.codigo] - DESEMPATE[b.codigo]);
  const faltan = cantidad - Object.values(cuotas).reduce((suma, cuota) => suma + cuota, 0);
  for (const { codigo } of restos.slice(0, faltan)) cuotas[codigo]++;
  return cuotas;
}

function comprobarMezcla(mezcla: readonly ObjetivoDificultad[]): void {
  const codigos = new Set(mezcla.map((d) => d.codigo));
  const validos = mezcla.every(
    ({ codigo, objetivo }) =>
      Object.hasOwn(DESEMPATE, codigo) &&
      Number.isInteger(objetivo) &&
      objetivo >= 0 &&
      objetivo <= 100,
  );
  if (
    codigos.size !== 3 ||
    mezcla.length !== 3 ||
    !validos ||
    mezcla.reduce((s, d) => s + d.objetivo, 0) !== 100
  ) {
    throw new Error('La mezcla debe incluir las tres dificultades y sumar 100.');
  }
}
