// De la propuesta de la IA a la pregunta que se guarda (HU-16.2). El orden de las alternativas lo decide el
// servidor, no el modelo: se barajan y se les reasignan las letras, para que la clave no caiga siempre en la
// misma posición. La «resolucion» sirvió para revisar la clave y no se guarda.
import type { PreguntaPropuesta } from '../../adaptadores/ia/proveedor.js';
import type { PropuestaDeIa } from '../preguntas/index.js';

const LETRAS = ['A', 'B', 'C', 'D', 'E'] as const;

/** Fisher-Yates con el azar inyectado (un número en [0, 1)). No cambia la lista original. */
export function barajar<T>(elementos: readonly T[], aleatorio: () => number): T[] {
  const resultado = [...elementos];
  for (let i = resultado.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(aleatorio() * (i + 1)));
    [resultado[i], resultado[j]] = [resultado[j]!, resultado[i]!];
  }
  return resultado;
}

export interface UbicacionDePropuesta {
  loteId: string;
  pruebaId: number;
  contenidoId: number;
  habilidadId: number;
  textoEstimuloId: string | null;
  ordenEnTexto: number | null;
}

export function aPropuestaGuardable(
  propuesta: PreguntaPropuesta,
  ubicacion: UbicacionDePropuesta,
  aleatorio: () => number,
): PropuestaDeIa {
  const alternativas = barajar(propuesta.alternativas, aleatorio).map((alternativa, i) => ({
    letra: LETRAS[i]!,
    texto: alternativa.texto,
    esCorrecta: alternativa.esCorrecta,
    explicacion: alternativa.explicacion,
  }));
  return {
    ...ubicacion,
    dificultadSugerida: propuesta.dificultadSugerida,
    enunciado: propuesta.enunciado,
    explicacion: propuesta.explicacion,
    alternativas,
  };
}
