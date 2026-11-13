// Bandeja de las solicitudes de datos en la consola (HU-55.1, RF-C10, C14): las pendientes por fecha
// límite, con los días que faltan o si venció, y la respuesta o el rechazo con un texto, que guarda
// quién la atendió y cuándo y queda en la auditoría (responder_solicitud) en la misma transacción.
// La fila se bloquea antes de responder: de dos administradores a la vez, el segundo recibe 409.
// La auditoría guarda el estado, la fecha y el autor, no el texto (plan HU-55, D4; RNF-09).
import { ErrorConflicto, ErrorNoEncontrado } from '../../comun/errores.js';
import type { Reloj } from '../../comun/reloj.js';
import type { UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type {
  EstadoSolicitud,
  FilaSolicitudConsola,
  PrivacidadRepositorio,
  RespuestaSolicitud,
} from './privacidad.repositorio.js';

const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;
const FECHA_EN_CHILE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santiago',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Una solicitud de la bandeja con su plazo ya calculado; la consola no repite la regla. */
export interface SolicitudConsola extends FilaSolicitudConsola {
  /** Días de calendario de Chile hasta la fecha límite (negativo si venció); `null` si ya se atendió. */
  diasRestantes: number | null;
  /** Pendiente y pasada su fecha límite. */
  vencida: boolean;
}

export interface FiltrosBandeja {
  estado: EstadoSolicitud;
  pagina: number;
  porPagina: number;
}

export interface BandejaSolicitudes {
  solicitudes: SolicitudConsola[];
  /** Total de pendientes, sea cual sea el filtro, para la pestaña de C14. */
  pendientes: number;
  paginacion: { pagina: number; porPagina: number; total: number };
}

/** Lo que envía el administrador (ya validado): cómo la atiende y el texto. */
export type AtencionSolicitud = Pick<RespuestaSolicitud, 'estado' | 'respuesta'>;

export interface SolicitudesConsola {
  listarSolicitudes(filtros: FiltrosBandeja): Promise<BandejaSolicitudes>;
  obtenerSolicitud(id: string): Promise<SolicitudConsola>;
  /** HU-55 esc. 2. Inexistente: 404. Ya respondida o rechazada: 409. */
  atenderSolicitud(
    administradorId: string,
    id: string,
    atencion: AtencionSolicitud,
  ): Promise<SolicitudConsola>;
}

export interface DependenciasSolicitudesConsola {
  repositorio: PrivacidadRepositorio;
  unidadDeTrabajo: UnidadDeTrabajo;
  administracion: Pick<AdministracionServicio, 'registrarAuditoria'>;
  reloj: Reloj;
}

/** Días entre dos fechas de calendario de Chile (las dos a medianoche UTC, sin cambios de hora). */
function diasEnChile(desde: Date, hasta: Date): number {
  const dia = (fecha: Date) => Date.parse(FECHA_EN_CHILE.format(fecha));
  return Math.round((dia(hasta) - dia(desde)) / MILISEGUNDOS_POR_DIA);
}

function conPlazo(fila: FilaSolicitudConsola, ahora: Date): SolicitudConsola {
  const pendiente = fila.estado.codigo === 'pendiente';
  const venceEn = new Date(fila.venceEn);
  return {
    ...fila,
    diasRestantes: pendiente ? diasEnChile(ahora, venceEn) : null,
    vencida: pendiente && ahora.getTime() > venceEn.getTime(),
  };
}

/** Responde o rechaza en una transacción: bloquea, guarda, audita y devuelve la solicitud atendida. */
function atender(
  { repositorio, unidadDeTrabajo, administracion, reloj }: DependenciasSolicitudesConsola,
  administradorId: string,
  [id, atencion]: [string, AtencionSolicitud],
): Promise<SolicitudConsola> {
  return unidadDeTrabajo.enTransaccion(async (tx) => {
    const actual = await repositorio.reservarSolicitud(id, tx);
    if (!actual) throw new ErrorNoEncontrado('La solicitud no existe.');
    if (actual.final) throw new ErrorConflicto(`La solicitud ya está «${actual.estado.nombre}».`);
    const respondidoEn = reloj();
    await repositorio.responderSolicitud(
      id,
      { ...atencion, respondidoEn, atendidoPor: administradorId },
      tx,
    );
    await administracion.registrarAuditoria(
      {
        usuarioId: administradorId,
        accion: 'responder_solicitud',
        entidad: 'solicitud_derecho',
        entidadId: id,
        antes: { estado: actual.estado.codigo },
        despues: {
          estado: atencion.estado,
          respondidoEn: respondidoEn.toISOString(),
          atendidoPor: administradorId,
        },
      },
      tx,
    );
    const atendida = await repositorio.solicitud(id, tx);
    if (!atendida) throw new ErrorNoEncontrado('La solicitud no existe.');
    return conPlazo(atendida, respondidoEn);
  });
}

export function crearSolicitudesConsola(
  dependencias: DependenciasSolicitudesConsola,
): SolicitudesConsola {
  const { repositorio, reloj } = dependencias;
  return {
    listarSolicitudes: async ({ estado, pagina, porPagina }) => {
      const desde = (pagina - 1) * porPagina;
      const { filas, total } = await repositorio.listarSolicitudes({
        estado,
        limite: porPagina,
        desde,
      });
      const ahora = reloj();
      return {
        solicitudes: filas.map((fila) => conPlazo(fila, ahora)),
        pendientes: await repositorio.contarPendientes(),
        paginacion: { pagina, porPagina, total },
      };
    },
    obtenerSolicitud: async (id) => {
      const fila = await repositorio.solicitud(id);
      if (!fila) throw new ErrorNoEncontrado('La solicitud no existe.');
      return conPlazo(fila, reloj());
    },
    atenderSolicitud: (administradorId, id, atencion) =>
      atender(dependencias, administradorId, [id, atencion]),
  };
}
