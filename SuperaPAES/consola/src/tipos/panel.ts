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

export interface IndicadoresPanel {
  periodo: PeriodoPanel;
  rango: { desde: string; hasta: string };
  estudiantes: { registrados: number; activos: number };
  preguntas: { porEstado: CantidadPanel[]; porDificultad: CantidadPanel[] };
  respuestasPorDia: RespuestasDelDia[];
  suscripciones: { vigentes: number; nuevas: number; canceladas: number };
  ia: { revisadas: number; aprobadas: number; tasa: number | null };
}
