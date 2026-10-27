// Lectura mínima del perfil que necesitan las prácticas. Las tablas de cuentas solo se consultan aquí.
import type { Ejecutor } from '../../db/transaccion.js';

export interface PerfilPractica {
  anioEgreso: number | null;
  pruebas: number[];
}

export function crearPerfilPracticaRepositorio(bd: Ejecutor) {
  return {
    async obtenerPerfilPractica(
      estudianteId: string,
      tx?: Ejecutor,
      bloquear = false,
    ): Promise<PerfilPractica | null> {
      const { rows } = await (tx ?? bd).query<PerfilPractica>(
        `SELECT e.anio_egreso AS "anioEgreso",
           COALESCE((SELECT array_agg(ep.prueba_id ORDER BY ep.prueba_id)
             FROM app.estudiante_prueba ep WHERE ep.estudiante_id=e.id), ARRAY[]::smallint[]) AS pruebas
         FROM app.estudiante e WHERE e.id=$1 AND e.eliminado_en IS NULL
         ${bloquear ? 'FOR UPDATE OF e' : ''}`,
        [estudianteId],
      );
      return rows[0] ?? null;
    },
  };
}
