// Reglas de C08 (CU-31, RN-35): qué hace inválida una estructura o una tabla, con el motivo para el administrador
// (4.a). Son funciones puras: la base repite lo esencial, pero aquí se explica antes de escribir.
import type {
  CambioEstructura,
  FilaEstructura,
  FilaReparto,
} from './evaluaciones.configuracion.repositorio.js';

export interface EdicionEstructura extends CambioEstructura {
  reparto: { id: number; cantidad: number }[];
}

export function problemaDelReparto(
  { reparto, cantidadMax, noPuntuables }: EdicionEstructura,
  actual: readonly FilaReparto[],
): string | null {
  if (reparto.length !== actual.length) return 'El reparto debe incluir todos sus ejes.';
  const porId = new Map(actual.map((fila) => [fila.id, fila]));
  if (new Set(reparto.map(({ id }) => id)).size !== reparto.length) {
    return 'El reparto repite un eje.';
  }
  for (const { id, cantidad } of reparto) {
    const fila = porId.get(id);
    if (!fila) return 'El reparto tiene un eje que no es de esta estructura.';
    if (cantidad <= fila.noPuntuables) {
      return `${fila.nombre} debe tener más preguntas que las ${String(fila.noPuntuables)} que no puntúan.`;
    }
  }
  if (reparto.length === 0) return null;
  const total = reparto.reduce((suma, { cantidad }) => suma + cantidad, 0);
  if (total !== cantidadMax) {
    return `El reparto suma ${String(total)} preguntas y deben ser ${String(cantidadMax)}.`;
  }
  const sinPuntaje = actual.reduce((suma, fila) => suma + fila.noPuntuables, 0);
  if (sinPuntaje > 0 && sinPuntaje !== noPuntuables) {
    return `El reparto tiene ${String(sinPuntaje)} preguntas que no puntúan y deben ser ${String(noPuntuables)}.`;
  }
  return null;
}

/** Lo que el formulario no puede cambiar de naturaleza: una evaluación sin tiempo sigue sin tiempo. */
export function problemaDeLaEstructura(
  datos: EdicionEstructura,
  actual: FilaEstructura,
  reparto: readonly FilaReparto[],
): string | null {
  if (datos.cantidadMin > datos.cantidadMax) {
    return 'La cantidad mínima no puede pasar la máxima.';
  }
  if (datos.noPuntuables >= datos.cantidadMin) {
    return 'Las preguntas que no puntúan deben ser menos que las preguntas de la evaluación.';
  }
  if (reparto.length > 0 && datos.cantidadMin !== datos.cantidadMax) {
    return 'Una evaluación con reparto tiene una sola cantidad de preguntas.';
  }
  if ((actual.duracionMin === null) !== (datos.duracionMin === null)) {
    return actual.duracionMin === null
      ? 'Esta evaluación no tiene tiempo.'
      : 'Esta evaluación debe tener tiempo.';
  }
  if ((actual.textos === null) !== (datos.textos === null)) {
    return actual.textos === null
      ? 'Esta evaluación no usa textos de lectura.'
      : 'Esta evaluación debe indicar sus textos de lectura.';
  }
  return problemaDelReparto(datos, reparto);
}

/** CU-31 paso 5: una fila por cantidad de correctas, desde 0 y con puntaje que no baja. */
export function problemaDeLasFilas(
  filas: readonly { correctas: number; puntaje: number }[],
): string | null {
  const ordenadas = [...filas].sort((a, b) => a.correctas - b.correctas);
  if (ordenadas[0]?.correctas !== 0) return 'La tabla debe partir en 0 respuestas correctas.';
  for (let i = 1; i < ordenadas.length; i++) {
    const anterior = ordenadas[i - 1]!;
    const actual = ordenadas[i]!;
    if (actual.correctas === anterior.correctas) {
      return `La tabla repite ${String(actual.correctas)} respuestas correctas.`;
    }
    if (actual.puntaje < anterior.puntaje) {
      return `El puntaje baja en ${String(actual.correctas)} respuestas correctas.`;
    }
  }
  return null;
}
