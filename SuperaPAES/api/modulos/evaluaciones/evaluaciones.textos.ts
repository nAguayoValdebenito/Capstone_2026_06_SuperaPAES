import type { CandidataEstructura, GrupoArmado } from './evaluaciones.estructura.tipos.js';
import type { CuotasDificultad } from './evaluaciones.seleccion.tipos.js';
import { corresponde } from './evaluaciones.asignacion.js';

/** Cada texto es indivisible. Busca una combinación exacta de textos, habilidades y dificultades. */
export function seleccionarTextos(
  grupos: GrupoArmado[],
  preguntas: CandidataEstructura[],
  cuotas: CuotasDificultad,
  cantidadTextos: number,
): CandidataEstructura[] | null {
  const textos = new Map<string, CandidataEstructura[]>();
  for (const p of preguntas)
    if (p.textoId) {
      const bloque = textos.get(p.textoId) ?? [];
      bloque.push(p);
      textos.set(p.textoId, bloque);
    }
  const dificultades = ['facil', 'media', 'dificil'] as const;
  const bloques = [...textos.values()].map((b) =>
    b.sort((a, c) => (a.ordenEnTexto ?? 0) - (c.ordenEnTexto ?? 0)),
  );
  const pesos = bloques.map((b) => [
    ...grupos.map((g) => b.filter((p) => corresponde(g, p)).length),
    ...dificultades.map((d) => b.filter((p) => p.dificultad === d).length),
  ]);
  const objetivo = [...grupos.map((g) => g.cupo), ...dificultades.map((d) => cuotas[d])];
  const fallidos = new Set<string>();
  function buscar(desde: number, faltan: number, pendientes: number[]): number[] | null {
    if (faltan === 0) return pendientes.every((n) => n === 0) ? [] : null;
    const clave = [desde, faltan, ...pendientes].join(',');
    if (fallidos.has(clave)) return null;
    for (let i = desde; i <= bloques.length - faltan; i++) {
      const resto = pendientes.map((n, j) => n - pesos[i]![j]!);
      if (resto.some((n) => n < 0)) continue;
      const siguientes = buscar(i + 1, faltan - 1, resto);
      if (siguientes) return [i, ...siguientes];
    }
    fallidos.add(clave);
    return null;
  }
  const indices = buscar(0, cantidadTextos, objetivo);
  return indices ? indices.flatMap((i) => bloques[i]!) : null;
}
