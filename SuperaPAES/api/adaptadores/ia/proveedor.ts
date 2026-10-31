// Interfaz común de los proveedores de IA que generan propuestas de preguntas.

export type Dificultad = 'facil' | 'media' | 'dificil';
export type Letra = 'A' | 'B' | 'C' | 'D' | 'E';

export interface SolicitudGeneracion {
  /** Preparada por HU-16.2, sin datos personales. El adaptador no construye contenido curricular. */
  instruccion: string;
}

/** Textos en Markdown con fórmulas en LaTeX, como se guardan en contenido.pregunta y alternativa. */
export interface PreguntaPropuesta {
  enunciado: string;
  /** Cada alternativa explica por qué es correcta o incorrecta (obligatorio en preguntas de IA). */
  alternativas: { letra: Letra; texto: string; esCorrecta: boolean; explicacion: string }[];
  explicacion: string;
  dificultadSugerida: Dificultad;
}

export interface ResultadoGeneracion {
  proveedor: ProveedorIA['nombre'];
  modelo: string;
  preguntas: PreguntaPropuesta[];
  tokensUsados?: number;
  usoTokens?: { entrada?: number; salida?: number; total?: number };
  /** Costo de la solicitud (contenido.lote_generacion.costo_usd), para el tope mensual de gasto. */
  costoUsd?: number;
}

export interface ProveedorIA {
  readonly nombre: 'simulado' | 'gemini' | 'deepseek';
  generarPreguntas(solicitud: SolicitudGeneracion): Promise<ResultadoGeneracion>;
}
