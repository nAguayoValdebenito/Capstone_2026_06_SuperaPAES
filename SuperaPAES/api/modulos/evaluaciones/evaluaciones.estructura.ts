import { calcularCuotas } from './evaluaciones.cuotas.js';
import type { ObjetivoDificultad } from './evaluaciones.seleccion.tipos.js';
import { asignarPreguntas, asignarPreguntasAgrupadas } from './evaluaciones.asignacion.js';
import { seleccionarTextos } from './evaluaciones.textos.js';
import type {
  EstructuraConTiempo,
  CandidataEstructura,
  GrupoArmado,
} from './evaluaciones.estructura.tipos.js';
export type {
  EstructuraConTiempo,
  CandidataEstructura,
  DetalleEstructura,
} from './evaluaciones.estructura.tipos.js';

/** RN-28 y RN-35: mayores restos, con desempate por el orden del temario. */
function repartirEjes(estructura: EstructuraConTiempo, electivoId: number | null): GrupoArmado[] {
  const disponibles = estructura.detalles.filter((d) => d.disponible);
  const peso = disponibles.reduce((s, d) => s + d.cantidad, 0);
  if (!peso) return [];
  const grupos = disponibles.map((d) => ({
    ...d,
    areaElectivoId: d.esElectivo ? electivoId : null,
    cupo: Math.floor((estructura.cantidad * d.cantidad) / peso),
    resto: (estructura.cantidad * d.cantidad) % peso,
  }));
  const faltan = estructura.cantidad - grupos.reduce((s, d) => s + d.cupo, 0);
  const orden = [...grupos].sort((a, b) => b.resto - a.resto || a.orden - b.orden);
  for (const g of orden.slice(0, faltan)) g.cupo++;
  return grupos;
}

export function armarEvaluacion(
  estructura: EstructuraConTiempo,
  candidatas: CandidataEstructura[],
  mezcla: ObjetivoDificultad[],
  electivoId: number | null = null,
): CandidataEstructura[] | null {
  const grupos = repartirEjes(estructura, electivoId);
  if (!grupos.length) return null;
  const cuotas = calcularCuotas(estructura.cantidad, mezcla);
  return estructura.codigo === 'CL'
    ? seleccionarTextos(grupos, candidatas, cuotas, estructura.textos ?? 0)
    : asignarPreguntas(grupos, candidatas, cuotas);
}

/** En Ciencias conserva el grupo asignado para sortear 1 no puntuable por eje y 2 del electivo. */
export function armarEnsayo(
  estructura: EstructuraConTiempo, candidatas: CandidataEstructura[],
  mezcla: ObjetivoDificultad[], electivoId: number | null,
) {
  if (estructura.codigo !== 'CIE') {
    const preguntas = armarEvaluacion(estructura, candidatas, mezcla, electivoId);
    return preguntas?.map((pregunta) => ({ pregunta, grupo: null })) ?? null;
  }
  return asignarPreguntasAgrupadas(
    repartirEjes(estructura, electivoId), candidatas,
    calcularCuotas(estructura.cantidad, mezcla),
  );
}
