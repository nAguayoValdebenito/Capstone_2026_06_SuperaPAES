// Llamadas a /api/v1/admin/revision (módulo revision de la API): bandeja de revisión, desempates y clasificación de dificultad.
// Cada función usa solicitarAdmin() de ../api/cliente.
import { solicitarAdmin } from '../api/cliente';
import { consultaDeListado, paginacionDe } from './paginacion';
import type { GrupoSeguimiento, PaginaSeguimiento, VistaSeguimiento } from '../tipos/seguimiento';
import type {
  DatosDesempate,
  DatosRevision,
  DesempateAbierto,
  DesempateEntregado,
  DificultadClasificada,
  EnvioARevision,
  PreguntaARevisar,
  RevisionEntregada,
  RevisionPendiente,
  SiguienteAClasificar,
} from '../tipos';

const MIS_REVISIONES = '/revision/mis-revisiones';
const DESEMPATES = '/revision/desempates';
const CLASIFICAR = '/revision/clasificar';

const opciones = (senal?: AbortSignal) => (senal ? { signal: senal } : {});

/** HU-21: pasa la pregunta a en revisión y le asigna sus revisores (RN-10). */
export async function enviarARevision(preguntaId: number): Promise<EnvioARevision> {
  const { data } = await solicitarAdmin<EnvioARevision>(
    `/revision/preguntas/${String(preguntaId)}`,
    { method: 'POST' },
  );
  return data;
}

/** C06: una página del grupo, con las cantidades de cada pestaña y las áreas sin docentes. */
export async function obtenerSeguimiento(
  grupo: GrupoSeguimiento,
  pagina: number,
  senal: AbortSignal,
): Promise<PaginaSeguimiento> {
  const consulta = consultaDeListado({ grupo }, pagina);
  const { data, meta } = await solicitarAdmin<VistaSeguimiento>(
    `/revision/seguimiento${consulta}`,
    {
      signal: senal,
    },
  );
  const paginacion = paginacionDe(meta, pagina, data.preguntas.length);
  return { seguimiento: data, paginacion };
}

/** HU-22: la bandeja del docente, la fecha límite más próxima primero. */
export async function listarMisRevisiones(senal?: AbortSignal): Promise<RevisionPendiente[]> {
  const { data } = await solicitarAdmin<RevisionPendiente[]>(MIS_REVISIONES, opciones(senal));
  return data;
}

/** HU-22: la pregunta a ciegas, con la pauta y las opciones. */
export async function obtenerMiRevision(
  id: number,
  senal?: AbortSignal,
): Promise<PreguntaARevisar> {
  const { data } = await solicitarAdmin<PreguntaARevisar>(
    `${MIS_REVISIONES}/${String(id)}`,
    opciones(senal),
  );
  return data;
}

/** HU-22 y CU-19: entrega la revisión con la pauta, la dificultad y la decisión. */
export async function entregarRevision(
  id: number,
  datos: DatosRevision,
): Promise<RevisionEntregada> {
  const { data } = await solicitarAdmin<RevisionEntregada>(`${MIS_REVISIONES}/${String(id)}`, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
  return data;
}

/**
 * HU-25 (D03): la siguiente importada por clasificar y cuántas quedan; con `despuesDe`, la que sigue a
 * esa asignación (saltar).
 */
export async function siguienteAClasificar(
  despuesDe: number | null,
  senal?: AbortSignal,
): Promise<SiguienteAClasificar> {
  const consulta = despuesDe === null ? '' : `?despuesDe=${String(despuesDe)}`;
  const { data } = await solicitarAdmin<SiguienteAClasificar>(
    `${CLASIFICAR}/siguiente${consulta}`,
    opciones(senal),
  );
  return data;
}

/** HU-25 y CU-19a (D03): la dificultad con un clic; devuelve lo guardado y la siguiente. */
export async function clasificarDificultad(
  id: number,
  dificultad: string,
): Promise<DificultadClasificada> {
  const { data } = await solicitarAdmin<DificultadClasificada>(`${CLASIFICAR}/${String(id)}`, {
    method: 'POST',
    body: JSON.stringify({ dificultad }),
  });
  return data;
}

/** HU-23 (D02): los desempates del docente, la fecha límite más próxima primero. */
export async function listarDesempates(senal?: AbortSignal): Promise<RevisionPendiente[]> {
  const { data } = await solicitarAdmin<RevisionPendiente[]>(DESEMPATES, opciones(senal));
  return data;
}

/** HU-23 (D02): la pregunta en desempate con las dos revisiones de la ronda. */
export async function obtenerDesempate(id: number, senal?: AbortSignal): Promise<DesempateAbierto> {
  const { data } = await solicitarAdmin<DesempateAbierto>(
    `${DESEMPATES}/${String(id)}`,
    opciones(senal),
  );
  return data;
}

/** CU-20: entrega la dificultad final, la decisión y el motivo del tercer docente. */
export async function entregarDesempate(
  id: number,
  datos: DatosDesempate,
): Promise<DesempateEntregado> {
  const { data } = await solicitarAdmin<DesempateEntregado>(`${DESEMPATES}/${String(id)}`, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
  return data;
}
