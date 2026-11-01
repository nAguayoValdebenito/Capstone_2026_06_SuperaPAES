import type { Ejecutor } from '../../db/transaccion.js';

export interface UsoGratis {
  estudianteId: string;
  pruebaId: number;
  estructuraId: number;
  evaluacionId: string;
  ahora: Date;
}

/** Los usos gratis del mes de Chile (RN-02) de una estructura: cuántos permite y cuántos van. */
export interface UsosDelMes {
  maximo: number;
  usados: number;
}

/** Se usa con el cliente de la transacción del inicio, nunca con otra conexión. */
export function crearUsosRepositorio() {
  return {
    async delMes(
      datos: Pick<UsoGratis, 'estudianteId' | 'estructuraId' | 'ahora'>,
      tx: Ejecutor,
    ): Promise<UsosDelMes> {
      const { rows } = await tx.query<UsosDelMes>(
        `SELECT s.usos_gratis_mes AS maximo,
           (SELECT count(*)::int FROM app.uso_gratis u
             WHERE u.estudiante_id=$1 AND u.estructura_id=s.id
               AND u.periodo=date_trunc('month', $3::timestamptz AT TIME ZONE 'America/Santiago')::date) AS usados
           FROM contenido.estructura_evaluacion s WHERE s.id=$2`,
        [datos.estudianteId, datos.estructuraId, datos.ahora],
      );
      return rows[0] ?? { maximo: 0, usados: 0 };
    },
    async registrar(datos: UsoGratis, tx: Ejecutor): Promise<boolean> {
      await tx.query('SELECT id FROM app.estudiante WHERE id=$1 FOR UPDATE', [datos.estudianteId]);
      const previa = await tx.query(
        'SELECT 1 FROM app.uso_gratis WHERE evaluacion_id=$1 AND estudiante_id=$2 AND estructura_id=$3',
        [datos.evaluacionId, datos.estudianteId, datos.estructuraId],
      );
      if (previa.rowCount) return true;
      const { rowCount } = await tx.query(
        `WITH mes AS (SELECT date_trunc('month', $4::timestamptz AT TIME ZONE 'America/Santiago')::date AS periodo),
         siguiente AS (SELECT COALESCE(MAX(u.numero),0)+1 AS numero FROM app.uso_gratis u, mes
           WHERE u.estudiante_id=$1 AND u.estructura_id=$2 AND u.periodo=mes.periodo)
         INSERT INTO app.uso_gratis (estudiante_id, estructura_id, periodo, numero, evaluacion_id)
         SELECT $1, s.id, mes.periodo, siguiente.numero, $3
           FROM contenido.estructura_evaluacion s, mes, siguiente
          WHERE s.id=$2 AND s.prueba_id=$5 AND siguiente.numero<=s.usos_gratis_mes
         ON CONFLICT DO NOTHING`,
        [datos.estudianteId, datos.estructuraId, datos.evaluacionId, datos.ahora, datos.pruebaId],
      );
      return rowCount === 1;
    },
  };
}
