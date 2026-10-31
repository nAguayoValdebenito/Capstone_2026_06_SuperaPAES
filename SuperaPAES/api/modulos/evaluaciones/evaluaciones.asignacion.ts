// Flujo de capacidad entera: cada pregunta puede ocupar un solo lugar y debe satisfacer a la vez
// la cuota de su grupo y la de dificultad. Evita que una elección voraz deje un reparto imposible.
import type { CandidataEstructura, GrupoArmado } from './evaluaciones.estructura.tipos.js';
import type { CuotasDificultad } from './evaluaciones.seleccion.tipos.js';

interface Arista {
  destino: number;
  capacidad: number;
  inversa: number;
}
type Grafo = Arista[][];
function conectar(g: Grafo, a: number, b: number, capacidad: number): Arista {
  const ida = { destino: b, capacidad, inversa: g[b]!.length };
  g[a]!.push(ida);
  g[b]!.push({ destino: a, capacidad: 0, inversa: g[a]!.length - 1 });
  return ida;
}

function aumentar(g: Grafo, destino: number): boolean {
  const padres = new Array<{ nodo: number; arista: Arista } | undefined>(g.length);
  const cola = [0];
  const vistos = new Set([0]);
  for (let i = 0; i < cola.length && !vistos.has(destino); i++) {
    const nodo = cola[i]!;
    for (const arista of g[nodo]!)
      if (arista.capacidad > 0 && !vistos.has(arista.destino)) {
        padres[arista.destino] = { nodo, arista };
        vistos.add(arista.destino);
        cola.push(arista.destino);
      }
  }
  if (!vistos.has(destino)) return false;
  for (let n = destino; n !== 0;) {
    const p = padres[n]!;
    p.arista.capacidad--;
    g[n]![p.arista.inversa]!.capacidad++;
    n = p.nodo;
  }
  return true;
}

export function corresponde(grupo: GrupoArmado, p: CandidataEstructura): boolean {
  if (grupo.esElectivo) return grupo.areaElectivoId === p.areaId;
  return grupo.ejeId !== null ? grupo.ejeId === p.ejeId : grupo.habilidadId === p.habilidadId;
}

export function asignarPreguntas(
  grupos: GrupoArmado[],
  candidatas: CandidataEstructura[],
  cuotas: CuotasDificultad,
): CandidataEstructura[] | null {
  const dificultades = ['facil', 'media', 'dificil'] as const;
  const inicioPreguntas = grupos.length + 1;
  const inicioDificultad = inicioPreguntas + candidatas.length;
  const fin = inicioDificultad + 3;
  const grafo: Grafo = Array.from({ length: fin + 1 }, () => []);
  grupos.forEach((grupo, i) => {
    conectar(grafo, 0, i + 1, grupo.cupo);
    candidatas.forEach((p, j) => {
      if (corresponde(grupo, p)) conectar(grafo, i + 1, inicioPreguntas + j, 1);
    });
  });
  const salidas = candidatas.map((p, j) =>
    conectar(grafo, inicioPreguntas + j, inicioDificultad + dificultades.indexOf(p.dificultad), 1),
  );
  dificultades.forEach((d, i) => conectar(grafo, inicioDificultad + i, fin, cuotas[d]));
  const total = grupos.reduce((s, g) => s + g.cupo, 0);
  let elegidas = 0;
  while (elegidas < total && aumentar(grafo, fin)) elegidas++;
  return elegidas === total ? candidatas.filter((_, j) => salidas[j]!.capacidad === 0) : null;
}
