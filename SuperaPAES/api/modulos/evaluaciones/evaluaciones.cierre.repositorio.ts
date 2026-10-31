import type { Ejecutor } from '../../db/transaccion.js';

export interface EvaluacionParaCierre {
  id: string;
  estado: string;
  cerradaEn: Date | null;
  venceEn: Date;
}
export function crearCierreRepositorio() {
  return {
    async bloquear(
      id: string,
      estudianteId: string,
      tx: Ejecutor,
    ): Promise<EvaluacionParaCierre | null> {
      const { rows } = await tx.query<EvaluacionParaCierre>(
        `SELECT e.id::text,s.codigo AS estado,e.cerrada_en AS "cerradaEn",e.vence_en AS "venceEn"
         FROM app.evaluacion e JOIN contenido.tipo_evaluacion t ON t.id=e.tipo_evaluacion_id
         JOIN contenido.estado_evaluacion s ON s.id=e.estado_evaluacion_id
         WHERE e.id=$1 AND e.estudiante_id=$2 AND t.con_tiempo FOR UPDATE OF e`,
        [id, estudianteId],
      );
      return rows[0] ?? null;
    },
    async reloj(tx: Ejecutor) {
      const { rows } = await tx.query<{ ahora: Date; inicio: Date }>(
        'SELECT clock_timestamp() AS ahora,transaction_timestamp() AS inicio',
      );
      return rows[0]!;
    },
    async cerrar(id: string, estado: string, tx: Ejecutor): Promise<void> {
      await tx.query('SELECT app.cerrar_evaluacion($1,$2)', [id, estado]);
    },
  };
}
