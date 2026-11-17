// Bono por invitación (HU-47.1, RN-03, CU-02a): app.invitacion y los abonos de app.movimiento_bono, del
// módulo cupo-invitaciones. La base exige que el abono sea para quien invitó, con la invitación ya
// verificada, y una sola vez por invitación (tg_movimiento_bono y el UNIQUE de invitacion_id). El mes es
// el de Chile de la hora del reloj del servicio, nunca now() (RN-02).
import type { Ejecutor } from '../../db/transaccion.js';

export interface InvitacionDelInvitado {
  id: string;
  invitanteId: string;
  verificada: boolean;
  bonoEntregado: boolean;
}

export interface Abono {
  invitacionId: string;
  invitanteId: string;
  cantidad: number;
  ahora: Date;
}

/** Abonos del invitante; con $2, solo los del mes de Chile de esa hora. */
const ABONOS = `
  FROM app.movimiento_bono m
  JOIN contenido.tipo_movimiento_bono t ON t.id = m.tipo_movimiento_bono_id
 WHERE m.estudiante_id = $1 AND t.codigo = 'abono'`;

const DEL_MES = `
   AND date_trunc('month', m.creado_en AT TIME ZONE 'America/Santiago')
     = date_trunc('month', $2::timestamptz AT TIME ZONE 'America/Santiago')`;

const INVITACION = `SELECT id::text AS id, invitante_id::text AS "invitanteId",
  verificado_en IS NOT NULL AS verificada, bono_entregado AS "bonoEntregado"
  FROM app.invitacion WHERE invitado_id = $1`;

/** Lo que A38 muestra de lo ganado invitando. */
function crearLecturasBono(bd: Ejecutor) {
  return {
    /** Invitaciones premiadas en el mes de Chile de `ahora` (RN-03). */
    async premiadasDelMes(invitanteId: string, ahora: Date, tx: Ejecutor = bd): Promise<number> {
      const { rows } = await tx.query<{ premiadas: number }>(
        `SELECT COUNT(*)::int AS premiadas ${ABONOS} ${DEL_MES}`,
        [invitanteId, ahora],
      );
      return rows[0]?.premiadas ?? 0;
    },
    /** Todas las preguntas extra que ganó invitando (A38). */
    async preguntasGanadas(invitanteId: string, tx: Ejecutor = bd): Promise<number> {
      const { rows } = await tx.query<{ ganadas: number }>(
        `SELECT COALESCE(SUM(m.cantidad), 0)::int AS ganadas ${ABONOS}`,
        [invitanteId],
      );
      return rows[0]?.ganadas ?? 0;
    },
  };
}

export function crearBonoRepositorio(bd: Ejecutor) {
  return {
    ...crearLecturasBono(bd),
    /**
     * La invitación con que se registró el invitado; null si llegó sin código. Antes de leerla bloquea,
     * en orden, todas las invitaciones de su invitante: dos invitados que verifican a la vez no pasan
     * juntos del tope del mes.
     */
    async bloquearInvitacionDe(
      invitadoId: string,
      tx: Ejecutor,
    ): Promise<InvitacionDelInvitado | null> {
      const { rows } = await tx.query<InvitacionDelInvitado>(INVITACION, [invitadoId]);
      const invitacion = rows[0];
      if (!invitacion) return null;
      await tx.query(
        'SELECT 1 FROM app.invitacion WHERE invitante_id = $1 ORDER BY id FOR UPDATE',
        [invitacion.invitanteId],
      );
      const { rows: bloqueada } = await tx.query<InvitacionDelInvitado>(INVITACION, [invitadoId]);
      return bloqueada[0] ?? null;
    },
    async marcarVerificada(invitacionId: string, ahora: Date, tx: Ejecutor): Promise<void> {
      await tx.query(
        'UPDATE app.invitacion SET verificado_en = $2 WHERE id = $1 AND verificado_en IS NULL',
        [invitacionId, ahora],
      );
    },
    /** El abono por la invitación y la marca de bono entregado, una sola vez. */
    async abonar(
      { invitacionId, invitanteId, cantidad, ahora }: Abono,
      tx: Ejecutor,
    ): Promise<void> {
      await tx.query(
        `INSERT INTO app.movimiento_bono
           (estudiante_id, tipo_movimiento_bono_id, cantidad, invitacion_id, creado_en)
         SELECT $1, id, $3, $2, $4 FROM contenido.tipo_movimiento_bono WHERE codigo = 'abono'`,
        [invitanteId, invitacionId, cantidad, ahora],
      );
      await tx.query('UPDATE app.invitacion SET bono_entregado = true WHERE id = $1', [
        invitacionId,
      ]);
    },
  };
}

export type BonoRepositorio = ReturnType<typeof crearBonoRepositorio>;
