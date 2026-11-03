// Tipos de la trazabilidad de suscripciones (C16, HU-56), tal como los entrega la API.
import type { Opcion, Paginacion } from './index';

/** Trazabilidad de suscripciones (C16, HU-56): el resumen del mes, por plan y estado, y por mes. */
export interface ResumenSuscripciones {
  activas: number;
  enMora: number;
  altasDelMes: number;
  cancelacionesDelMes: number;
  ingresosDelMes: number;
  avisosConError: number;
  porPlanYEstado: { plan: string; estado: Opcion; suscripciones: number }[];
  meses: { mes: string; pagosAprobados: number; pagosRechazados: number; ingresosClp: number }[];
  estados: Opcion[];
  planes: { id: number; nombre: string }[];
}

/** Filtros de la lista de suscripciones (HU-56 esc. 2); las fechas, AAAA-MM-DD. */
export interface FiltrosSuscripciones {
  estado?: string;
  plan?: number;
  desde?: string;
  hasta?: string;
  correo?: string;
}

export interface SuscripcionDeLaLista {
  id: number;
  /** null si el estudiante eliminó su cuenta (seudonimizada). */
  correo: string | null;
  plan: string;
  tienda: Opcion;
  estado: Opcion;
  creadoEn: string;
}

export interface PaginaDeSuscripciones {
  suscripciones: SuscripcionDeLaLista[];
  paginacion: Paginacion;
}

/** Un aviso de Google Play o la App Store y lo que el sistema hizo con él. */
export interface AvisoDeTienda {
  id: number;
  tienda: Opcion;
  tipo: string;
  resultado: Opcion;
  /** En un aviso con error, el motivo. */
  detalle: string | null;
  recibidoEn: string;
}

export interface AvisoConError extends AvisoDeTienda {
  suscripcionId: number | null;
}

/** La suscripción con su línea de tiempo (de la más nueva), sus pagos y los avisos de la tienda. */
export interface DetalleSuscripcion extends SuscripcionDeLaLista {
  historial: {
    id: number;
    fecha: string;
    estadoAnterior: Opcion | null;
    estadoNuevo: Opcion;
    planAnterior: string | null;
    planNuevo: string;
    origen: Opcion;
    detalle: string | null;
  }[];
  pagos: {
    id: number;
    montoClp: number;
    estado: Opcion;
    periodoInicio: string;
    periodoFin: string;
    creadoEn: string;
  }[];
  avisos: AvisoDeTienda[];
}
