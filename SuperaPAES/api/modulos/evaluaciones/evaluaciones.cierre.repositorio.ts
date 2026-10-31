import type { Ejecutor } from '../../db/transaccion.js';
import { RelojDeCierreAntiguo } from './evaluaciones.cierre-transaccion.js';

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
    async cerrar(id: string, estado: string, tx: Ejecutor): Promise<string> {
      const { rows } = await tx.query<{
        cerrada: boolean;
        vencida: boolean;
        reintentar: boolean;
        estado: string;
      }>(
        `WITH reloj AS MATERIALIZED (SELECT clock_timestamp() AS ahora)
         SELECT e.cerrada_en IS NOT NULL AS cerrada,s.codigo AS estado,COALESCE(e.vence_en<=reloj.ahora,false) AS vencida,
          (transaction_timestamp()<e.iniciada_en OR
            (e.vence_en<=reloj.ahora AND transaction_timestamp()<e.vence_en)) AS reintentar
         FROM app.evaluacion e JOIN contenido.estado_evaluacion s ON s.id=e.estado_evaluacion_id,reloj WHERE e.id=$1`,
        [id],
      );
      const fila = rows[0]!;
      if (fila.cerrada) return fila.estado;
      if (fila.reintentar) throw new RelojDeCierreAntiguo();
      const final = fila.vencida ? 'tiempo_agotado' : estado;
      await tx.query('SELECT app.cerrar_evaluacion($1,$2)', [id, final]);
      return final;
    },
  };
}
