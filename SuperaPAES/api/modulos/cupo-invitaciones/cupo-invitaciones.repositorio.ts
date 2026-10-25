// Único lugar con SQL del módulo cupo-invitaciones. Consultas siempre parametrizadas ($1, $2...).
// Tablas que pertenecen a este módulo (ningún otro módulo las escribe):
//   - app.cupo_diario
//   - app.uso_gratis
//   - app.invitacion
//   - app.movimiento_bono
// Cada método recibe un Ejecutor opcional (tx) para sumarse a la transacción del servicio.
import type { Ejecutor } from '../../db/transaccion.js';

export interface CupoInvitacionesRepositorio {
  /**
   * Sube el máximo de la fila de hoy (app.hoy_chile()) del estudiante, si ya existe, sin tocar las
   * usadas y sin bajarlo nunca. Si no existe, no crea nada.
   */
  subirMaximoDelDia(estudianteId: string, maximo: number, tx?: Ejecutor): Promise<void>;
}

export function crearCupoInvitacionesRepositorio(bd: Ejecutor): CupoInvitacionesRepositorio {
  return {
    async subirMaximoDelDia(estudianteId, maximo, tx = bd) {
      await tx.query(
        `UPDATE app.cupo_diario SET maximo = GREATEST(maximo, $2)
          WHERE estudiante_id = $1 AND fecha = app.hoy_chile()`,
        [estudianteId, maximo],
      );
    },
  };
}
