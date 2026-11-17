// Tipos de la calibración de la dificultad (D04, HU-26 y HU-53): la bandeja del docente, las confirmadas
// que ve el administrador en el banco (C02) y las estadísticas por pregunta.

/** La dificultad asignada con el rango de acierto esperado (RN-15), en porcentaje. */
export interface DificultadConRango {
  codigo: string;
  nombre: string;
  aciertoEsperadoMin: number;
  aciertoEsperadoMax: number;
}

/** Intentos, aciertos y tiempo promedio de una pregunta (HU-53). */
export interface EstadisticaPregunta {
  preguntaId: string;
  intentos: number;
  aciertos: number;
  /** `null` si no tiene intentos. */
  porcentajeAcierto: number | null;
  tiempoPromedioSeg: number | null;
}

/** Una fila de la bandeja del docente (D04): la pregunta de su área fuera de su rango. */
export interface ItemCalibracion extends EstadisticaPregunta {
  enunciado: string;
  prueba: string;
  contenido: string;
  dificultad: DificultadConRango;
  porcentajeAcierto: number;
  /** Docentes que confirmaron que la dificultad no corresponde. */
  confirmaciones: number;
  /** Docentes que dijeron que la dificultad sí corresponde. */
  descartes: number;
}

/** Una pregunta publicada que algún docente confirmó (C02, HU-26.2). */
export interface ConfirmadaCalibracion extends Omit<ItemCalibracion, 'porcentajeAcierto'> {
  porcentajeAcierto: number | null;
  confirmadaEn: string;
}

/** La decisión del docente sobre una pregunta de su bandeja. */
export interface DecisionCalibracion {
  preguntaId: string;
  dificultadCorresponde: boolean;
  creadoEn: string;
}
