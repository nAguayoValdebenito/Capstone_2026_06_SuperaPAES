// Llamadas a /api/v1/admin/preguntas (módulo preguntas de la API): banco de preguntas, importaciones y avisos de error de los estudiantes.
// Cada función usa solicitarAdmin() de ../api/cliente.
import { solicitarAdmin } from '../api/cliente';
import { consultaDeListado, paginacionDe } from './paginacion';
import type {
  ArchivosImportacion,
  ArchivoCsv,
  CambioDeEtapa,
  DatosPregunta,
  FiltrosBanco,
  ImportacionHecha,
  InformeImportacion,
  Opcion,
  OpcionesFiltrosBanco,
  PaginaDelBanco,
  PreguntaConEtapa,
  PreguntaDelBanco,
  PreguntaParaEditar,
  TextoDeLectura,
} from '../tipos';

const PREGUNTAS = '/preguntas';

/** CU-16 paso 1: plantillas del mismo formato que lee el servidor. */
export async function obtenerPlantillasImportacion(): Promise<
  Record<'preguntas' | 'textos', ArchivoCsv>
> {
  const { data } = await solicitarAdmin<Record<'preguntas' | 'textos', ArchivoCsv>>(
    `${PREGUNTAS}/importaciones/plantillas`,
  );
  return data;
}

const opciones = (senal?: AbortSignal) => (senal ? { signal: senal } : {});

/** Consulta del banco: solo los filtros con valor, y la página. */
export const consultaDelBanco = (filtros: FiltrosBanco, pagina: number): string =>
  consultaDeListado(filtros, pagina);

/** HU-11: una página del banco con los filtros elegidos. */
export async function listarBanco(
  filtros: FiltrosBanco,
  pagina: number,
  senal?: AbortSignal,
): Promise<PaginaDelBanco> {
  const { data, meta } = await solicitarAdmin<PreguntaDelBanco[]>(
    `${PREGUNTAS}${consultaDelBanco(filtros, pagina)}`,
    opciones(senal),
  );
  return { preguntas: data, paginacion: paginacionDe(meta, pagina, data.length) };
}

export async function obtenerFiltrosBanco(senal?: AbortSignal): Promise<OpcionesFiltrosBanco> {
  const { data } = await solicitarAdmin<OpcionesFiltrosBanco>(
    `${PREGUNTAS}/filtros`,
    opciones(senal),
  );
  return data;
}

/** HU-12.1: la pregunta con su correcta, para editarla. */
export async function obtenerPregunta(
  id: number,
  senal?: AbortSignal,
): Promise<PreguntaParaEditar> {
  const { data } = await solicitarAdmin<PreguntaParaEditar>(
    `${PREGUNTAS}/${String(id)}`,
    opciones(senal),
  );
  return data;
}

/** HU-12.1: la pregunta nueva queda en borrador. */
export async function crearPregunta(datos: DatosPregunta): Promise<PreguntaParaEditar> {
  const { data } = await solicitarAdmin<PreguntaParaEditar>(PREGUNTAS, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
  return data;
}

/** HU-12.1 y RF-G09: solo en borrador u observada. */
export async function editarPregunta(
  id: number,
  datos: DatosPregunta,
): Promise<PreguntaParaEditar> {
  const { data } = await solicitarAdmin<PreguntaParaEditar>(`${PREGUNTAS}/${String(id)}`, {
    method: 'PUT',
    body: JSON.stringify(datos),
  });
  return data;
}

/** HU-12.2: textos de lectura guardados; la búsqueda es por título. */
export async function listarTextos(buscar: string, senal?: AbortSignal): Promise<TextoDeLectura[]> {
  const consulta = buscar.trim()
    ? `?${new URLSearchParams({ buscar: buscar.trim() }).toString()}`
    : '';
  const { data } = await solicitarAdmin<TextoDeLectura[]>(
    `${PREGUNTAS}/textos${consulta}`,
    opciones(senal),
  );
  return data;
}

export async function listarTiposDeTexto(senal?: AbortSignal): Promise<Opcion[]> {
  const { data } = await solicitarAdmin<Opcion[]>(`${PREGUNTAS}/textos/tipos`, opciones(senal));
  return data;
}

/** HU-13.2: el informe de la importación (C04), sin guardar nada. */
export async function revisarImportacion(
  archivos: ArchivosImportacion,
  senal?: AbortSignal,
): Promise<InformeImportacion> {
  const { data } = await solicitarAdmin<InformeImportacion>(`${PREGUNTAS}/importaciones/revision`, {
    method: 'POST',
    body: JSON.stringify(archivos),
    ...opciones(senal),
  });
  return data;
}

/** HU-13.2 y RN-29: importa las preguntas válidas con la declaración del origen. */
export async function importarPreguntas(archivos: ArchivosImportacion): Promise<ImportacionHecha> {
  const { data } = await solicitarAdmin<ImportacionHecha>(`${PREGUNTAS}/importaciones`, {
    method: 'POST',
    body: JSON.stringify({ ...archivos, declaraOrigen: true }),
  });
  return data;
}

/** HU-24 (CU-21): publica una aprobada, retira una publicada o vuelve a borrador una retirada. */
export async function cambiarEtapa(id: number, cambio: CambioDeEtapa): Promise<PreguntaConEtapa> {
  const { data } = await solicitarAdmin<PreguntaConEtapa>(`${PREGUNTAS}/${String(id)}/${cambio}`, {
    method: 'POST',
  });
  return data;
}
