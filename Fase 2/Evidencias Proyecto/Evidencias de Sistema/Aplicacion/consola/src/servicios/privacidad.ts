// Llamadas a /api/v1/admin/privacidad (módulo privacidad de la API): solicitudes de los estudiantes sobre sus datos personales.
// Cada función usa solicitarAdmin() de ../api/cliente.
import { solicitarAdmin } from '../api/cliente';
import type {
  AtencionSolicitud,
  BandejaSolicitudes,
  EstadoSolicitud,
  SolicitudDeDatos,
} from '../tipos/solicitudes-datos';
import { consultaDeListado, paginacionDe } from './paginacion';

const SOLICITUDES = '/privacidad/solicitudes';

/** HU-55 esc. 1: la bandeja de un estado (las pendientes, por fecha límite) y el total de pendientes. */
export async function listarSolicitudes(
  estado: EstadoSolicitud,
  pagina: number,
  senal?: AbortSignal,
): Promise<BandejaSolicitudes> {
  const { data, meta } = await solicitarAdmin<Omit<BandejaSolicitudes, 'paginacion'>>(
    `${SOLICITUDES}${consultaDeListado({ estado }, pagina)}`,
    senal ? { signal: senal } : {},
  );
  return { ...data, paginacion: paginacionDe(meta, pagina, data.solicitudes.length) };
}

/** HU-55 esc. 2: responde o rechaza una solicitud pendiente con un texto. */
export async function atenderSolicitud(
  id: number,
  estado: AtencionSolicitud,
  respuesta: string,
): Promise<SolicitudDeDatos> {
  const { data } = await solicitarAdmin<SolicitudDeDatos>(`${SOLICITUDES}/${String(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ estado, respuesta }),
  });
  return data;
}
