// SQL de las acciones en lote del banco (C02): las preguntas que cumplen los filtros del banco y están en
// ciertas etapas, en orden de creación, y cuántas hay para cada acción. Usa el mismo filtro que la tabla
// del banco (PREGUNTAS_FILTRADAS, $1 a $7). Consultas siempre parametrizadas.
import type { Ejecutor } from '../../db/transaccion.js';
import type { FiltroResuelto } from './preguntas.filtros-banco.js';
import { PREGUNTAS_FILTRADAS, parametrosDelFiltro } from './preguntas.repositorio.js';

/** Cuántas preguntas del filtro se pueden enviar a revisión y cuántas publicar sin revisión. */
export interface ConteoDelLote {
  paraRevision: number;
  paraPublicar: number;
}

export interface LoteRepositorio {
  /** Ids de las preguntas del filtro en alguna de las `etapas`, las más antiguas primero. */
  elegibles(
    filtro: FiltroResuelto,
    etapas: readonly string[],
    limite: number,
    tx?: Ejecutor,
  ): Promise<string[]>;
  contar(
    filtro: FiltroResuelto,
    etapas: [readonly string[], readonly string[]],
  ): Promise<ConteoDelLote>;
}

const ELEGIBLES = `
  SELECT p.id::text AS id
  ${PREGUNTAS_FILTRADAS}
     AND ep.codigo = ANY ($8::text[])
   ORDER BY p.id
   LIMIT $9`;

const CONTEO = `
  SELECT count(*) FILTER (WHERE ep.codigo = ANY ($8::text[]))::int AS "paraRevision",
         count(*) FILTER (WHERE ep.codigo = ANY ($9::text[]))::int AS "paraPublicar"
  ${PREGUNTAS_FILTRADAS}`;

export function crearLoteRepositorio(bd: Ejecutor): LoteRepositorio {
  return {
    async elegibles(filtro, etapas, limite, tx = bd) {
      const { rows } = await tx.query<{ id: string }>(ELEGIBLES, [
        ...parametrosDelFiltro(filtro),
        etapas,
        limite,
      ]);
      return rows.map((fila) => fila.id);
    },

    async contar(filtro, [revision, publicar]) {
      const { rows } = await bd.query<ConteoDelLote>(CONTEO, [
        ...parametrosDelFiltro(filtro),
        revision,
        publicar,
      ]);
      return rows[0] ?? { paraRevision: 0, paraPublicar: 0 };
    },
  };
}
