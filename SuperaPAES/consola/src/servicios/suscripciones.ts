// Llamadas a /api/v1/admin/suscripciones (módulo suscripciones de la API): planes, suscripciones, pagos y avisos de las tiendas.
// Cada función usa solicitarAdmin() de ../api/cliente.
import { solicitarAdmin } from '../api/cliente';
import type { Paginacion } from '../tipos';
import type {
  AvisoConError,
  DetalleSuscripcion,
  FiltrosSuscripciones,
  PaginaDeSuscripciones,
  ResumenSuscripciones,
  SuscripcionDeLaLista,
} from '../tipos/suscripciones';
import { consultaDeListado, paginacionDe } from './paginacion';

const SUSCRIPCIONES = '/suscripciones';

const opciones = (senal?: AbortSignal) => (senal ? { signal: senal } : {});

/** HU-56 esc. 1: el resumen, con las opciones de los filtros. */
export async function obtenerResumenSuscripciones(
  senal?: AbortSignal,
): Promise<ResumenSuscripciones> {
  const { data } = await solicitarAdmin<ResumenSuscripciones>(
    `${SUSCRIPCIONES}/resumen`,
    opciones(senal),
  );
  return data;
}

/** HU-56 esc. 2: una página de suscripciones con los filtros elegidos. */
export async function listarSuscripciones(
  filtros: FiltrosSuscripciones,
  pagina: number,
  senal?: AbortSignal,
): Promise<PaginaDeSuscripciones> {
  const { data, meta } = await solicitarAdmin<SuscripcionDeLaLista[]>(
    `${SUSCRIPCIONES}/${consultaDeListado(filtros, pagina)}`,
    opciones(senal),
  );
  return { suscripciones: data, paginacion: paginacionDe(meta, pagina, data.length) };
}

/** HU-56 esc. 3: la línea de tiempo de una suscripción, con sus pagos y avisos. */
export async function obtenerSuscripcion(
  id: number,
  senal?: AbortSignal,
): Promise<DetalleSuscripcion> {
  const { data } = await solicitarAdmin<DetalleSuscripcion>(
    `${SUSCRIPCIONES}/${String(id)}`,
    opciones(senal),
  );
  return data;
}

/** HU-56 esc. 4: una página de la bandeja de avisos con error. */
export async function listarAvisosConError(
  pagina: number,
  senal?: AbortSignal,
): Promise<{ avisos: AvisoConError[]; paginacion: Paginacion }> {
  const { data, meta } = await solicitarAdmin<AvisoConError[]>(
    `${SUSCRIPCIONES}/avisos-error${consultaDeListado({}, pagina)}`,
    opciones(senal),
  );
  return { avisos: data, paginacion: paginacionDe(meta, pagina, data.length) };
}
