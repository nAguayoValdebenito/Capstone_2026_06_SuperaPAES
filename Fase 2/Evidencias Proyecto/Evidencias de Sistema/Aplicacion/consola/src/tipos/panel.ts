// C01 · Panel (HU-48, CU-25): lo que entrega GET /admin/administracion/panel.
export type PeriodoPanel = 'hoy' | '7d' | '30d' | 'mes';

export interface CantidadPanel {
  nombre: string;
  total: number;
}

export interface RespuestasDelDia {
  dia: string;
  total: number;
}

/** Las cifras que se comparan con el período anterior. */
export interface CifrasDelPeriodo {
  estudiantes: { registrados: number; activos: number };
  suscripciones: { vigentes: number; nuevas: number; canceladas: number };
  ia: { revisadas: number; aprobadas: number; tasa: number | null };
}

export interface IndicadoresPanel extends CifrasDelPeriodo {
  periodo: PeriodoPanel;
  rango: { desde: string; hasta: string };
  preguntas: { porEstado: CantidadPanel[]; porDificultad: CantidadPanel[] };
  respuestasPorDia: RespuestasDelDia[];
  /** El período de la misma duración justo antes; `registrados` y `vigentes` son los del inicio del período. */
  anterior: CifrasDelPeriodo & { rango: { desde: string; hasta: string } };
}
