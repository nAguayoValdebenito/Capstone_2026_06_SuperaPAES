// SQL del cierre de respaldo de las canceladas (HU-45.1, CU-12 1.a): las suscripciones activas cuyo
// estudiante canceló la renovación y cuyo período pagado terminó hace más de un día. Normalmente las cierra
// el aviso de vencimiento de la tienda; esto cubre el aviso que no llegó. Consultas parametrizadas.
import type { Ejecutor } from '../../db/transaccion.js';

/** Una cancelada que terminó su período, bloqueada para cerrarla. */
export interface CanceladaPorCerrar {
  id: string;
  planId: number;
}

// SKIP LOCKED: si un aviso la está procesando, se deja para la próxima hora.
const POR_CERRAR = `
  SELECT s.id::text AS id, s.plan_id AS "planId"
    FROM app.suscripcion s
    JOIN contenido.estado_suscripcion e ON e.id = s.estado_suscripcion_id
   WHERE e.codigo = 'activa' AND s.cancelada_en IS NOT NULL
     AND s.periodo_fin < $1::timestamptz - INTERVAL '1 day'
   ORDER BY s.id
     FOR UPDATE OF s SKIP LOCKED`;

export function crearCierreRepositorio(bd: Ejecutor) {
  return {
    async porCerrar(ahora: Date, tx: Ejecutor = bd): Promise<CanceladaPorCerrar[]> {
      const { rows } = await tx.query<CanceladaPorCerrar>(POR_CERRAR, [ahora]);
      return rows;
    },

    async cancelar(id: string, tx: Ejecutor = bd): Promise<void> {
      await tx.query(
        `UPDATE app.suscripcion
            SET estado_suscripcion_id =
                  (SELECT id FROM contenido.estado_suscripcion WHERE codigo = 'cancelada')
          WHERE id = $1`,
        [id],
      );
    },
  };
}

export type CierreRepositorio = ReturnType<typeof crearCierreRepositorio>;
