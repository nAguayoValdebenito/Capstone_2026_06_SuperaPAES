// Forma de las preguntas de ejemplo de la semilla de desarrollo (db/semilla-demo.ts).

/** Aparece al inicio de cada enunciado y texto: nadie confunde estas preguntas con el banco real (RN-29). */
export const MARCA_EJEMPLO = '[EJEMPLO]';

export interface Alternativa {
  texto: string;
  explicacion: string;
}

export interface PreguntaDeEjemplo {
  prueba: string;
  dificultad: 'facil' | 'media' | 'dificil';
  enunciado: string;
  explicacion: string;
  /** La primera es la correcta; la semilla le asigna su letra, que cambia entre preguntas. */
  alternativas: [Alternativa, Alternativa, Alternativa, Alternativa];
  /** Solo Competencia Lectora: cada pregunta va ligada a un texto (RN-08). */
  texto?: { titulo: string; contenido: string };
  /** Nombre del eje; sin él, el primero de la prueba. */
  eje?: string;
  /** Nombre de la habilidad; sin él, la primera de la prueba. */
  habilidad?: string;
}

/** Texto de una alternativa y por qué es o no es la correcta. */
export type Opcion = readonly [texto: string, explicacion: string];

const alternativa = ([texto, explicacion]: Opcion): Alternativa => ({ texto, explicacion });

/** Lo que cambia entre una pregunta y otra, en una sola línea de datos. */
export interface DatosPregunta {
  dificultad: PreguntaDeEjemplo['dificultad'];
  enunciado: string;
  explicacion: string;
  correcta: Opcion;
  errores: readonly [Opcion, Opcion, Opcion];
  eje?: string;
  habilidad?: string;
  texto?: NonNullable<PreguntaDeEjemplo['texto']>;
}

export function preguntaDe(prueba: string, datos: DatosPregunta): PreguntaDeEjemplo {
  const { correcta, errores, enunciado, ...resto } = datos;
  return {
    ...resto,
    prueba,
    enunciado: `${MARCA_EJEMPLO} ${enunciado}`,
    alternativas: [
      alternativa(correcta),
      alternativa(errores[0]),
      alternativa(errores[1]),
      alternativa(errores[2]),
    ],
  };
}
