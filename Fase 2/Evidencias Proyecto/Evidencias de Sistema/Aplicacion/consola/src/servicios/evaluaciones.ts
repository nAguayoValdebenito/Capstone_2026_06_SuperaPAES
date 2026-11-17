// Llamadas a /api/v1/admin/evaluaciones (módulo evaluaciones de la API): estructuras y tablas de conversión (C08).
import { solicitarAdmin } from '../api/cliente';
import type { ImpactoDeAnular } from '../tipos/avisos-error';
import type { EstadisticaPregunta } from '../tipos/calibracion';
import type {
  EdicionEstructura,
  Estructura,
  NuevaTabla,
  TablaConversion,
  TablasDeLaPrueba,
} from '../tipos/evaluaciones';

const ESTRUCTURAS = '/evaluaciones/estructuras';
const TABLAS = '/evaluaciones/tablas-conversion';

export async function listarEstructuras(
  pruebaId: number,
  senal: AbortSignal,
): Promise<Estructura[]> {
  const ruta = `${ESTRUCTURAS}?pruebaId=${String(pruebaId)}`;
  return (await solicitarAdmin<Estructura[]>(ruta, { signal: senal })).data;
}

export async function editarEstructura(id: number, datos: EdicionEstructura): Promise<Estructura> {
  const { data } = await solicitarAdmin<Estructura>(`${ESTRUCTURAS}/${String(id)}`, {
    method: 'PUT',
    body: JSON.stringify(datos),
  });
  return data;
}

export async function listarTablas(
  pruebaId: number,
  senal: AbortSignal,
): Promise<TablasDeLaPrueba> {
  const ruta = `${TABLAS}?pruebaId=${String(pruebaId)}`;
  return (await solicitarAdmin<TablasDeLaPrueba>(ruta, { signal: senal })).data;
}

export async function cargarTabla(datos: NuevaTabla): Promise<TablaConversion> {
  const { data } = await solicitarAdmin<TablaConversion>(TABLAS, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
  return data;
}

/** HU-50.2 (C13): en cuántas evaluaciones aparece la pregunta, antes de anularla. */
export async function impactoDeAnular(
  preguntaId: number,
  senal?: AbortSignal,
): Promise<ImpactoDeAnular> {
  const ruta = `/evaluaciones/preguntas/${String(preguntaId)}/impacto`;
  return (await solicitarAdmin<ImpactoDeAnular>(ruta, senal ? { signal: senal } : {})).data;
}

/** HU-53 (C02): intentos, acierto y tiempo promedio de las preguntas de una página del banco. */
export async function estadisticasDePreguntas(
  preguntaIds: readonly number[],
  senal?: AbortSignal,
): Promise<EstadisticaPregunta[]> {
  if (preguntaIds.length === 0) return [];
  const ruta = `/evaluaciones/estadisticas?preguntas=${preguntaIds.map(String).join(',')}`;
  return (await solicitarAdmin<EstadisticaPregunta[]>(ruta, senal ? { signal: senal } : {})).data;
}
