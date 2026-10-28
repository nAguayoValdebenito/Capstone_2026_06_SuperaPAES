// Lectura mínima de la cuenta que necesita el inicio de la app (HU-35.1). Las tablas de cuentas solo
// se consultan en este módulo.
import type { Ejecutor } from '../../db/transaccion.js';

/** Lo que el inicio necesita saber de la cuenta para mostrar el cupo y la racha. */
export interface EstadoCuentaInicio {
  /** Decide el máximo del día cuando todavía no hay fila de cupo (RN-01). */
  correoVerificado: boolean;
  /**
   * Días seguidos practicando (RF-A05). La base la actualiza al responder; mientras no responda hoy
   * se muestra la de ayer, y si el último día con respuestas es anterior a ayer, es 0.
   */
  racha: number;
}

/** El día de Chile de la hora dada, nunca now(): el reloj del servicio decide qué día es (RN-02). */
const ESTADO_INICIO = `
  SELECT correo_verificado AS "correoVerificado",
         CASE WHEN ultimo_dia_practica >= ($2::timestamptz AT TIME ZONE 'America/Santiago')::date - 1
              THEN racha_dias ELSE 0 END AS racha
    FROM app.estudiante
   WHERE id = $1 AND eliminado_en IS NULL`;

export function crearInicioRepositorio(bd: Ejecutor) {
  return {
    async estadoParaInicio(
      estudianteId: string,
      ahora: Date,
      tx: Ejecutor = bd,
    ): Promise<EstadoCuentaInicio | null> {
      const { rows } = await tx.query<EstadoCuentaInicio>(ESTADO_INICIO, [estudianteId, ahora]);
      return rows[0] ?? null;
    },
  };
}
