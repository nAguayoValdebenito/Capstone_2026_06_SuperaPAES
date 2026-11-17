// Contrato interno de selección: no contiene enunciados, alternativas, claves ni explicaciones.
export type CodigoDificultad = 'facil' | 'media' | 'dificil';
export interface ObjetivoDificultad {
  codigo: CodigoDificultad;
  objetivo: number;
}
export type CuotasDificultad = Record<CodigoDificultad, number>;
export interface PreguntaSeleccionada {
  preguntaId: string;
  version: number;
}

/** Como en app.evaluacion, a lo más un alcance. Se valida también en tiempo de ejecución. */
export interface FiltrosSeleccion {
  estudianteId: string;
  pruebaId: number;
  ejeId?: number;
  contenidoId?: number;
  habilidadId?: number;
  dificultad?: CodigoDificultad;
  /** Curso calculado al iniciar la práctica por app.nivel_escolar_en; null si no está definido. */
  nivelEscolarId?: number | null;
  /** Fecha de inicio para calcular el curso si todavía no existe app.evaluacion. */
  iniciadaEn: Date;
  entregadas: readonly PreguntaSeleccionada[];
}
export interface DatosSeleccion extends FiltrosSeleccion {
  cantidad: number;
  /** Permite al prompt 15 conservar las cuotas originales entre entregas. */
  cuotas?: CuotasDificultad;
}
export interface CandidataSeleccion extends PreguntaSeleccionada {
  dificultad: CodigoDificultad;
  ejeId: number;
  habilidadId: number;
  textoId: string | null;
  ordenEnTexto: number | null;
  debil: boolean;
  lectora: boolean;
}
export interface HistorialEntrega extends PreguntaSeleccionada {
  dificultad: CodigoDificultad;
  ejeId: number;
  habilidadId: number;
  textoId: string | null;
  debil: boolean;
}
export interface ParametrosSeleccion {
  ahora: Date;
  diasSinRepetir: number;
  minRespuestas: number;
  umbralDebil: number;
}
