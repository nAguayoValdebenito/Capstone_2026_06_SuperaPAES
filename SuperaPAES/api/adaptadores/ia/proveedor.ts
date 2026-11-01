// Interfaz común de los proveedores de IA que generan propuestas de preguntas.

export type Dificultad = 'facil' | 'media' | 'dificil';
export type Letra = 'A' | 'B' | 'C' | 'D' | 'E';

/** Lo que fija la prueba de la pregunta pedida: cuántas alternativas lleva y qué habilidades admite. */
export interface FormatoPregunta {
  /** RN-08: 4 o 5 según la prueba (contenido.prueba.opciones_max). */
  alternativas: number;
  /** Códigos de las habilidades de la prueba (contenido.habilidad.codigo). */
  habilidades: readonly string[];
}

export interface SolicitudGeneracion {
  /** Preparada por HU-16.2, sin datos personales. El adaptador no construye contenido curricular. */
  instruccion: string;
  /** Esquema del pedido; sin él, el esquema general (letras A a E y habilidad libre). */
  formato?: FormatoPregunta;
  /** Temperatura configurada de cada proveedor; cada adaptador usa la suya. Sin ella, la del proveedor. */
  temperaturas?: Partial<Record<'deepseek' | 'gemini', number>>;
}

/** Textos en Markdown con fórmulas en LaTeX, como se guardan en contenido.pregunta y alternativa. */
export interface PreguntaPropuesta {
  enunciado: string;
  /**
   * El cálculo paso a paso, escrito antes de las alternativas. Sirve para que el modelo acierte y para
   * comprobar la clave (HU-17.1); no se guarda ni llega a la app.
   */
  resolucion: string;
  /** Código de la habilidad (contenido.habilidad.codigo) que el modelo declara evaluar. */
  habilidad: string;
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

export type ProveedorIAReal = 'gemini' | 'deepseek';

export interface ProveedorIA {
  readonly nombre: 'simulado' | 'gemini' | 'deepseek';
  /** Los proveedores reales a los que puede llamar (DeepSeek con respaldo: los dos). Cada uno tiene precio. */
  readonly usa: readonly ProveedorIAReal[];
  generarPreguntas(solicitud: SolicitudGeneracion): Promise<ResultadoGeneracion>;
}
