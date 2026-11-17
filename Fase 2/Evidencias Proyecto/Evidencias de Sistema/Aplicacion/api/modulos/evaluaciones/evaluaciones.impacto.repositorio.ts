// Cuántas evaluaciones tienen una pregunta (HU-50.2, C13): la consola lo muestra antes de anularla, con el
// mismo criterio que app.anular_pregunta (se recalculan las cerradas). Solo lee tablas de este módulo.
import type { Ejecutor } from '../../db/transaccion.js';

/** Evaluaciones donde aparece la pregunta, cerradas y abiertas. */
export interface ImpactoDeAnular {
  evaluacionesCerradas: number;
  evaluacionesAbiertas: number;
}

const CONTAR = `
  SELECT count(*) FILTER (WHERE ev.cerrada_en IS NOT NULL)::int AS "evaluacionesCerradas",
         count(*) FILTER (WHERE ev.cerrada_en IS NULL)::int AS "evaluacionesAbiertas"
    FROM app.evaluacion ev
   WHERE EXISTS (SELECT 1 FROM app.evaluacion_item i WHERE i.evaluacion_id = ev.id AND i.pregunta_id = $1)`;

export interface ImpactoRepositorio {
  contar(preguntaId: string): Promise<ImpactoDeAnular>;
}

export function crearImpactoRepositorio(bd: Ejecutor): ImpactoRepositorio {
  return {
    async contar(preguntaId) {
      const { rows } = await bd.query<ImpactoDeAnular>(CONTAR, [preguntaId]);
      return rows[0] ?? { evaluacionesCerradas: 0, evaluacionesAbiertas: 0 };
    },
  };
}
