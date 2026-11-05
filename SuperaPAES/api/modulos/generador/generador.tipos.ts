// Tipos compartidos del módulo generador (HU-16 a HU-18).
export type EstadoLote = 'pendiente' | 'completado' | 'fallido';

/** El pedido que llega por HTTP ya validado: contenido, cantidad (hasta max_preguntas_lote) y si lleva texto. */
export interface DatosNuevoLoteHttp {
  contenidoId: number;
  cantidad: number;
  conTexto: boolean;
}

/** Lo que se guarda al crear un lote. */
export interface DatosNuevoLote extends DatosNuevoLoteHttp {
  solicitanteId: string;
  modelo: string;
  versionInstrucciones: string;
  ahora: Date;
}

/** Cuánto se ha usado de los topes de la IA (RNF-03), en días y meses de Chile. */
export interface UsoDeLaIa {
  hoy: { usadas: number; maximo: number };
  mes: { gastadoUsd: number; maximoUsd: number };
}

/** El lote tal como lo ve la consola. El avance es `procesadas` de `cantidad` (HU-16 esc. 5). */
export interface LoteDto {
  id: string;
  estado: EstadoLote;
  contenidoId: number;
  cantidad: number;
  conTexto: boolean;
  validas: number;
  descartadas: number;
  procesadas: number;
  modelo: string;
  versionInstrucciones: string;
  tokensUsados: number | null;
  costoUsd: number | null;
  /** Resumen de descartes y de la falla, si hubo (contenido.lote_generacion.motivos_descarte). */
  motivos: unknown;
  creadoEn: Date;
}
