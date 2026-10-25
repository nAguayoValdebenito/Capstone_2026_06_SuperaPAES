// Selección sobre metadatos; el SQL vive en el repositorio y el azar lo entrega el consumidor.
import type {
  CandidataSeleccion,
  CodigoDificultad,
  CuotasDificultad,
  DatosSeleccion,
  HistorialEntrega,
} from './evaluaciones.seleccion.tipos.js';

// Decisión aprobada en prompt 14: cerca de la mitad de la práctica refuerza grupos débiles.
// Mantener este peso en un solo lugar hasta incorporarlo como parámetro documentado del DAS.
const PORCENTAJE_PREGUNTAS_DEBILES = 50;
const ORDEN_DIFICULTAD: Record<CodigoDificultad, number> = { facil: 0, media: 1, dificil: 2 };
const DESEMPATE: readonly CodigoDificultad[] = ['media', 'facil', 'dificil'];
type Bloque = CandidataSeleccion[];

function agrupar(candidatas: readonly CandidataSeleccion[]): Bloque[] {
  const grupos = new Map<string, Bloque>();
  for (const candidata of candidatas) {
    const clave = candidata.lectora
      ? `texto:${candidata.textoId}`
      : `pregunta:${candidata.preguntaId}`;
    const grupo = grupos.get(clave) ?? [];
    grupo.push(candidata);
    grupos.set(clave, grupo);
  }
  return [...grupos.values()].map((grupo) =>
    grupo.sort((a, b) => (a.ordenEnTexto ?? 0) - (b.ordenEnTexto ?? 0)),
  );
}

function elegirDificultad(
  bloques: Bloque[],
  cuotas: CuotasDificultad,
  entregadas: readonly HistorialEntrega[],
): Bloque[] {
  const pendientes = { ...cuotas };
  for (const p of entregadas) pendientes[p.dificultad]--;
  const orden = [...DESEMPATE].sort((a, b) => pendientes[b] - pendientes[a]);
  for (const dificultad of orden) {
    if (pendientes[dificultad] <= 0) continue;
    const disponibles = bloques.filter((b) => b.some((p) => p.dificultad === dificultad));
    if (disponibles.length) return disponibles;
  }
  // Si la cuota pendiente se agotó, usa la dificultad más cercana; empate: la más fácil.
  const origen = orden[0]!;
  const cercanas = [...DESEMPATE].sort(
    (a, b) =>
      Math.abs(ORDEN_DIFICULTAD[a] - ORDEN_DIFICULTAD[origen]) -
        Math.abs(ORDEN_DIFICULTAD[b] - ORDEN_DIFICULTAD[origen]) ||
      ORDEN_DIFICULTAD[a] - ORDEN_DIFICULTAD[b],
  );
  for (const dificultad of cercanas) {
    const disponibles = bloques.filter((b) => b.some((p) => p.dificultad === dificultad));
    if (disponibles.length) return disponibles;
  }
  return bloques;
}

const grupoDe = (p: { ejeId: number; habilidadId: number }, lectora: boolean) =>
  lectora ? p.habilidadId : p.ejeId;

function priorizarGrupos(
  bloques: Bloque[],
  datos: DatosSeleccion,
  entregadas: readonly HistorialEntrega[],
): Bloque[] {
  if (
    datos.ejeId !== undefined ||
    datos.contenidoId !== undefined ||
    datos.habilidadId !== undefined
  )
    return bloques;
  const objetivo = Math.ceil((datos.cantidad * PORCENTAJE_PREGUNTAS_DEBILES) / 100);
  const faltanDebiles = entregadas.filter((p) => p.debil).length < objetivo;
  const preferidos = bloques.filter((b) => b.some((p) => p.debil === faltanDebiles));
  const opciones = preferidos.length ? preferidos : bloques;
  const lectora = opciones[0]![0]!.lectora;
  const entregasPorGrupo = new Map<number, number>();
  for (const p of entregadas) {
    const grupo = grupoDe(p, lectora);
    entregasPorGrupo.set(grupo, (entregasPorGrupo.get(grupo) ?? 0) + 1);
  }
  const cantidad = (b: Bloque) => entregasPorGrupo.get(grupoDe(b[0]!, lectora)) ?? 0;
  const minimo = opciones.reduce((menor, bloque) => Math.min(menor, cantidad(bloque)), Infinity);
  return opciones.filter((b) => cantidad(b) === minimo);
}

export function seleccionarCandidata(
  contexto: {
    candidatas: readonly CandidataSeleccion[];
    entregadas: readonly HistorialEntrega[];
    datos: DatosSeleccion;
    cuotas: CuotasDificultad;
  },
  azar: () => number,
): CandidataSeleccion | null {
  const { candidatas, entregadas, datos, cuotas } = contexto;
  if (candidatas.length === 0) return null;
  const bloques = agrupar(candidatas);
  const ultimoTexto = entregadas.at(-1)?.textoId;
  const continuacion = bloques.find(
    (b) => b[0]!.lectora && ultimoTexto && b[0]!.textoId === ultimoTexto,
  );
  if (continuacion) return continuacion[0]!;
  const faltan = datos.cantidad - entregadas.length;
  const caben = bloques.filter((b) => b.length <= faltan);
  const opciones = elegirDificultad(caben.length ? caben : bloques, cuotas, entregadas);
  const preferidas = priorizarGrupos(opciones, datos, entregadas);
  const numero = azar();
  if (!Number.isFinite(numero) || numero < 0 || numero >= 1)
    throw new Error('El azar debe devolver un número entre 0 (incluido) y 1 (excluido).');
  return preferidas[Math.floor(numero * preferidas.length)]![0]!;
}
