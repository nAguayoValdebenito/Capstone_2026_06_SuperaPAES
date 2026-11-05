// HU-18.3: texto completo y preguntas del lote, mediante las consultas del módulo preguntas.
import { solicitarAdmin } from '../api/cliente';
import type { PreguntaParaEditar } from '../tipos';
import { listarBanco, obtenerPregunta } from './preguntas';
import { totalDePaginas } from './paginacion';

export interface TextoGenerado {
  id: string;
  titulo: string | null;
  contenido: string | null;
  imagenUrl: string | null;
}

export interface LecturaDelLote {
  texto: TextoGenerado;
  preguntas: PreguntaParaEditar[];
}

async function preguntasDelLote(lote: string, senal: AbortSignal) {
  const preguntas: PreguntaParaEditar[] = [];
  let pagina = 1;
  let paginas: number;
  do {
    const datos = await listarBanco({ lote }, pagina, senal);
    preguntas.push(
      ...(await Promise.all(datos.preguntas.map(({ id }) => obtenerPregunta(id, senal)))),
    );
    paginas = totalDePaginas(datos.paginacion);
    pagina += 1;
  } while (pagina <= paginas);
  return preguntas;
}

/** Nunca mezcla otros lotes del mismo contenido ni limita la vista a la primera página. */
export async function obtenerLecturasDelLote(
  lote: string,
  senal: AbortSignal,
): Promise<LecturaDelLote[]> {
  const grupos = new Map<number, PreguntaParaEditar[]>();
  for (const pregunta of await preguntasDelLote(lote, senal)) {
    const id = pregunta.textoEstimuloId;
    if (id === null) throw new Error('Una pregunta del lote no tiene su texto de lectura.');
    const grupo = grupos.get(id) ?? [];
    grupo.push(pregunta);
    grupos.set(id, grupo);
  }
  return Promise.all(
    [...grupos].map(async ([id, preguntas]) => {
      const { data: texto } = await solicitarAdmin<TextoGenerado>(
        `/preguntas/textos/${String(id)}`,
        {
          signal: senal,
        },
      );
      preguntas.sort((a, b) => (a.ordenEnTexto ?? 0) - (b.ordenEnTexto ?? 0) || a.id - b.id);
      return { texto, preguntas };
    }),
  );
}
