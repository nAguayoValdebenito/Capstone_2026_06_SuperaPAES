// C05 · Generador con IA (HU-16, HU-17 y HU-18): lo que entrega /admin/generador/lotes.
import type { Paginacion } from './index';

export type EstadoLote = 'pendiente' | 'completado' | 'fallido';

/** Resumen de lo descartado. Los códigos y su texto están en utilidades/generador.ts. */
export interface MotivosLote {
  porMotivo?: Record<string, number>;
  fallas?: Record<string, number>;
  textos?: Record<string, number>;
  cierre?: string;
}

export interface Lote {
  id: string;
  estado: EstadoLote;
  contenidoId: number;
  cantidad: number;
  conTexto: boolean;
  validas: number;
  descartadas: number;
  procesadas: number;
  modelo: string;
  motivos: MotivosLote | null;
  creadoEn: string;
}

export interface PedidoLote {
  contenidoId: number;
  cantidad: number;
  conTexto: boolean;
}

export interface PaginaLotes {
  lotes: Lote[];
  paginacion: Paginacion;
}
