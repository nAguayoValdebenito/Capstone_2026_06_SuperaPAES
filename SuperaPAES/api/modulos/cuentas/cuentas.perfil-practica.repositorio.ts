// Lectura mínima del perfil que necesitan las prácticas y el cupo. Las tablas de cuentas solo se
// consultan aquí.
import type { Ejecutor } from '../../db/transaccion.js';

export interface PerfilPractica {
  anioEgreso: number | null;
  pruebas: number[];
  electivoId?: number | null;
}

/** Lo que el cupo necesita saber de la cuenta: el correo verificado decide el máximo del día. */
export interface EstadoCuentaCupo {
  correoVerificado: boolean;
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
             FROM app.estudiante_prueba ep WHERE ep.estudiante_id=e.id), ARRAY[]::smallint[]) AS pruebas,
           (SELECT ep.electivo_area_id FROM app.estudiante_prueba ep
             WHERE ep.estudiante_id=e.id AND ep.electivo_area_id IS NOT NULL LIMIT 1) AS "electivoId"
         FROM app.estudiante e WHERE e.id=$1 AND e.eliminado_en IS NULL
         ${bloquear ? 'FOR UPDATE OF e' : ''}`,
        [estudianteId],
      );
      return rows[0] ?? null;
    },
    async estadoParaCupo(
      estudianteId: string,
      tx?: Ejecutor,
      bloquear = false,
    ): Promise<EstadoCuentaCupo | null> {
      const { rows } = await (tx ?? bd).query<EstadoCuentaCupo>(
        `SELECT correo_verificado AS "correoVerificado" FROM app.estudiante
         WHERE id=$1 AND eliminado_en IS NULL ${bloquear ? 'FOR UPDATE' : ''}`,
        [estudianteId],
      );
      return rows[0] ?? null;
    },
  };
}
