// Único lugar con SQL del módulo cupo-invitaciones. Consultas siempre parametrizadas ($1, $2...).
// Tablas que pertenecen a este módulo (ningún otro módulo las escribe):
//   - app.cupo_diario
//   - app.uso_gratis
//   - app.invitacion
//   - app.movimiento_bono
// Cada método recibe un Ejecutor opcional (tx) para sumarse a la transacción del servicio.
// El día del cupo es la fecha de Chile de la hora que entrega el reloj del servicio (RN-02), nunca
// now(): así un mismo instante cae siempre en el mismo día, también en los cambios de horario.
import type { Ejecutor } from '../../db/transaccion.js';

/** Quién invitó a quién y cuándo se registró el invitado (app.invitacion). */
export interface NuevaInvitacion {
  invitanteId: string;
  invitadoId: string;
  registradoEn: Date;
}

/** Fila de app.cupo_diario de un estudiante en un día de Chile. */
export interface CupoDelDia {
  maximo: number;
  usadas: number;
}

export interface CupoInvitacionesRepositorio {
  /** Crea la fila de app.invitacion, sin bono ni dispositivo (HU-47 y HU-47.1 los agregan). */
  crearInvitacion(invitacion: NuevaInvitacion, tx?: Ejecutor): Promise<void>;
  /**
   * Sube el máximo de la fila del día de `ahora` del estudiante, si ya existe, sin tocar las usadas y
   * sin bajarlo nunca. Si no existe, no crea nada.
   */
  subirMaximoDelDia(
    estudianteId: string,
    maximo: number,
    ahora: Date,
    tx?: Ejecutor,
  ): Promise<void>;
  /** La fila del día de `ahora`, o null si todavía no existe. */
  leerCupoDelDia(estudianteId: string, ahora: Date, tx?: Ejecutor): Promise<CupoDelDia | null>;
  /** Crea la fila del día de `ahora` con su máximo y cero usadas; si ya existe, no la cambia. */
  crearCupoDelDia(estudianteId: string, ahora: Date, maximo: number, tx?: Ejecutor): Promise<void>;
  /**
   * Descuenta una pregunta de la fila del día con una sola sentencia, solo si quedan: dos respuestas
   * a la vez nunca pasan del máximo. Devuelve false si ya no quedaba ninguna.
   */
  descontarCupoDelDia(estudianteId: string, ahora: Date, tx?: Ejecutor): Promise<boolean>;
  /** Saldo de preguntas extra: abonos menos consumos de app.movimiento_bono. */
  leerSaldoExtra(estudianteId: string, tx?: Ejecutor): Promise<number>;
  /** Movimiento de consumo de una pregunta extra (cantidad 1), ligado al ítem respondido. */
  registrarConsumoExtra(
    estudianteId: string,
    evaluacionItemId: string,
    ahora: Date,
    tx?: Ejecutor,
  ): Promise<void>;
}

const FECHA_CHILE = "($2::timestamptz AT TIME ZONE 'America/Santiago')::date";

type ConsultasCupoDelDia = Pick<
  CupoInvitacionesRepositorio,
  'subirMaximoDelDia' | 'leerCupoDelDia' | 'crearCupoDelDia' | 'descontarCupoDelDia'
>;
type ConsultasSaldoExtra = Pick<
  CupoInvitacionesRepositorio,
  'leerSaldoExtra' | 'registrarConsumoExtra'
>;

function crearConsultasCupoDelDia(bd: Ejecutor): ConsultasCupoDelDia {
  return {
    async subirMaximoDelDia(estudianteId, maximo, ahora, tx = bd) {
      await tx.query(
        `UPDATE app.cupo_diario SET maximo = GREATEST(maximo, $3)
          WHERE estudiante_id = $1 AND fecha = ${FECHA_CHILE}`,
        [estudianteId, ahora, maximo],
      );
    },

    async leerCupoDelDia(estudianteId, ahora, tx = bd) {
      const { rows } = await tx.query<CupoDelDia>(
        `SELECT maximo, usadas FROM app.cupo_diario
          WHERE estudiante_id = $1 AND fecha = ${FECHA_CHILE}`,
        [estudianteId, ahora],
      );
      return rows[0] ?? null;
    },

    async crearCupoDelDia(estudianteId, ahora, maximo, tx = bd) {
      await tx.query(
        `INSERT INTO app.cupo_diario (estudiante_id, fecha, maximo) VALUES ($1, ${FECHA_CHILE}, $3)
         ON CONFLICT (estudiante_id, fecha) DO NOTHING`,
        [estudianteId, ahora, maximo],
      );
    },

    async descontarCupoDelDia(estudianteId, ahora, tx = bd) {
      const { rowCount } = await tx.query(
        `UPDATE app.cupo_diario SET usadas = usadas + 1
          WHERE estudiante_id = $1 AND fecha = ${FECHA_CHILE} AND usadas < maximo`,
        [estudianteId, ahora],
      );
      return rowCount === 1;
    },
  };
}

function crearConsultasSaldoExtra(bd: Ejecutor): ConsultasSaldoExtra {
  return {
    async leerSaldoExtra(estudianteId, tx = bd) {
      const { rows } = await tx.query<{ saldo: number }>(
        `SELECT COALESCE(SUM(t.signo * m.cantidad), 0)::int AS saldo
           FROM app.movimiento_bono m
           JOIN contenido.tipo_movimiento_bono t ON t.id = m.tipo_movimiento_bono_id
          WHERE m.estudiante_id = $1`,
        [estudianteId],
      );
      return rows[0]?.saldo ?? 0;
    },

    async registrarConsumoExtra(estudianteId, evaluacionItemId, ahora, tx = bd) {
      await tx.query(
        `INSERT INTO app.movimiento_bono
           (estudiante_id, tipo_movimiento_bono_id, cantidad, evaluacion_item_id, creado_en)
         SELECT $1, id, 1, $2, $3 FROM contenido.tipo_movimiento_bono WHERE codigo = 'consumo'`,
        [estudianteId, evaluacionItemId, ahora],
      );
    },
  };
}

export function crearCupoInvitacionesRepositorio(bd: Ejecutor): CupoInvitacionesRepositorio {
  return {
    async crearInvitacion({ invitanteId, invitadoId, registradoEn }, tx = bd) {
      await tx.query(
        'INSERT INTO app.invitacion (invitante_id, invitado_id, registrado_en) VALUES ($1, $2, $3)',
        [invitanteId, invitadoId, registradoEn],
      );
    },
    ...crearConsultasCupoDelDia(bd),
    ...crearConsultasSaldoExtra(bd),
  };
}
