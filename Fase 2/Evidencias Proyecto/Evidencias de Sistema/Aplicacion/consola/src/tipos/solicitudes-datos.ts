// Solicitudes de los estudiantes sobre sus datos personales (C14, HU-55, Ley 21.719): lo que entregan
// /api/v1/admin/privacidad/solicitudes y su respuesta o rechazo.
import type { Opcion, Paginacion } from './index';

/** Estados de contenido.estado_solicitud: las pestañas de C14. */
export type EstadoSolicitud = 'pendiente' | 'respondida' | 'rechazada';

/** Cómo se atiende una solicitud pendiente (HU-55 esc. 2). */
export type AtencionSolicitud = Exclude<EstadoSolicitud, 'pendiente'>;

export interface SolicitudDeDatos {
  id: number;
  tipo: Opcion;
  /** Lo que pidió el estudiante, si lo explicó. */
  detalle: string | null;
  estado: Opcion;
  solicitadoEn: string;
  venceEn: string;
  /** Días de calendario de Chile hasta la fecha límite (negativo si venció); null si ya se atendió. */
  diasRestantes: number | null;
  vencida: boolean;
  respondidoEn: string | null;
  respuesta: string | null;
  atendidoPor: { id: number; nombre: string } | null;
  /** Solo lo necesario para atenderla (RNF-09). Una cuenta eliminada llega sin nombre ni correo. */
  estudiante: {
    id: number;
    nombre: string | null;
    correo: string | null;
    cuentaEliminada: boolean;
  };
}

export interface BandejaSolicitudes {
  solicitudes: SolicitudDeDatos[];
  /** Total de pendientes, sea cual sea la pestaña. */
  pendientes: number;
  paginacion: Paginacion;
}
