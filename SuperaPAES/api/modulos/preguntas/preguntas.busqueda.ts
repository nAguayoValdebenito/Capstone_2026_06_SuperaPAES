// Búsqueda global de preguntas de la consola (Ctrl K): por ID (un número o la forma P-0084) o por texto
// del enunciado, sin distinguir mayúsculas ni tildes. Solo lectura, con límite de resultados.
import type { Ejecutor } from '../../db/transaccion.js';

export interface PreguntaEncontrada {
  /** Como texto desde la base; `comun/ids-respuesta.ts` lo convierte en número al responder. */
  id: string;
  resumen: string;
  prueba: { codigo: string };
  estado: { codigo: string; nombre: string };
}

export interface BusquedaPreguntas {
  buscarPreguntas(texto: string, limite: number): Promise<PreguntaEncontrada[]>;
}

export interface BusquedaRepositorio {
  /** `id` es el ID exacto si el texto lo era; `patron` es el texto ya sin tildes, para un LIKE. */
  buscar(consulta: {
    id: string | null;
    patron: string;
    limite: number;
  }): Promise<PreguntaEncontrada[]>;
}

/** «P-0084», «p84» o «84» → «84»; otro texto → null. */
export function idDelTexto(texto: string): string | null {
  const coincidencia = /^p?-?\s*0*(\d{1,15})$/i.exec(texto.trim());
  return coincidencia?.[1] ?? null;
}

/** El texto en minúsculas y sin tildes, con los comodines de LIKE escapados. */
export function patronDeBusqueda(texto: string): string {
  const sinTildes = texto
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
  return `%${sinTildes.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
}

// El ID exacto primero y luego lo más reciente. translate() quita las tildes del enunciado.
const BUSCAR = `
  SELECT p.id::text AS id, left(p.enunciado, 120) AS resumen,
         json_build_object('codigo', pr.codigo) AS prueba,
         json_build_object('codigo', ep.codigo, 'nombre', ep.nombre) AS estado
    FROM contenido.pregunta p
    JOIN contenido.prueba pr ON pr.id = p.prueba_id
    JOIN contenido.estado_pregunta ep ON ep.id = p.estado_pregunta_id
   WHERE ($1::bigint IS NOT NULL AND p.id = $1)
      OR translate(lower(p.enunciado), 'áéíóúüñ', 'aeiouun') LIKE $2
   ORDER BY (p.id = $1::bigint) DESC NULLS LAST, p.actualizado_en DESC, p.id DESC
   LIMIT $3`;

export function crearBusquedaRepositorio(bd: Ejecutor): BusquedaRepositorio {
  return {
    async buscar({ id, patron, limite }) {
      return (await bd.query<PreguntaEncontrada>(BUSCAR, [id, patron, limite])).rows;
    },
  };
}

export function crearBusquedaPreguntas(repositorio: BusquedaRepositorio): BusquedaPreguntas {
  return {
    buscarPreguntas: (texto, limite) =>
      repositorio.buscar({ id: idDelTexto(texto), patron: patronDeBusqueda(texto), limite }),
  };
}
