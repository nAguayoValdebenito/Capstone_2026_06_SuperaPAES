// SQL de la recuperación de la contraseña del estudiante (HU-06, CU-04) del módulo cuentas, aparte de
// cuentas.repositorio.ts para que cada archivo quede corto. Consultas siempre parametrizadas.
// Escribe tablas de cuentas (app.token_correo y app.estudiante) y lee contenido.tipo_token_correo por
// su código, nunca por su id. Cada método recibe un Ejecutor opcional (tx) para sumarse a la
// transacción del servicio; las horas llegan del reloj del servicio, salvo el trigger tg_token_correo,
// que usa now() al anular el enlace anterior cuando se emite uno nuevo.
import type { Ejecutor } from '../../db/transaccion.js';

/** Cuenta de un estudiante tal como la ve la recuperación. Nunca lleva el hash de la contraseña. */
export interface CuentaDeRecuperacion {
  id: string;
  nombre: string;
  correo: string;
}

export interface TokenRecuperacion {
  id: string;
  estudianteId: string;
  expiraEn: Date;
  /** Sin usar y sin anular (no considera el vencimiento, que depende del reloj). */
  abierto: boolean;
}

export interface NuevoTokenRecuperacion {
  estudianteId: string;
  tipoId: number;
  hashToken: string;
  expiraEn: Date;
}

export interface RecuperacionRepositorio {
  /** Por correo, sin distinguir mayúsculas y sin las cuentas eliminadas. */
  buscarCuentaPorCorreo(correo: string, tx?: Ejecutor): Promise<CuentaDeRecuperacion | null>;
  /** Horas de vigencia del enlace (contenido.tipo_token_correo, código recuperacion). */
  tipoRecuperacion(tx?: Ejecutor): Promise<{ id: number; horasVigencia: number }>;
  /** Sin código: la recuperación solo trae enlace. El trigger anula el enlace anterior (CU-04 2.a). */
  insertarToken(token: NuevoTokenRecuperacion, tx?: Ejecutor): Promise<void>;
  /** Dueño del enlace de recuperación, sin bloquear (para bloquear primero a la cuenta). */
  cuentaDelEnlace(hashToken: string, tx?: Ejecutor): Promise<string | null>;
  /** Bloquea la cuenta (FOR UPDATE) hasta el fin de la transacción. Una cuenta eliminada no está. */
  bloquearCuenta(id: string, tx?: Ejecutor): Promise<CuentaDeRecuperacion | null>;
  /** Bloquea el enlace de recuperación (FOR UPDATE), esté o no vigente. */
  bloquearToken(hashToken: string, tx?: Ejecutor): Promise<TokenRecuperacion | null>;
  marcarTokenUsado(id: string, ahora: Date, tx?: Ejecutor): Promise<void>;
  actualizarContrasena(estudianteId: string, hashContrasena: string, tx?: Ejecutor): Promise<void>;
}

const TIPO_RECUPERACION = `
  SELECT id, horas_vigencia AS "horasVigencia"
    FROM contenido.tipo_token_correo
   WHERE codigo = 'recuperacion'`;

const SELECCION_CUENTA = `SELECT id::text AS id, nombre, correo FROM app.estudiante`;

const SELECCION_TOKEN = `
  SELECT t.id::text AS id, t.estudiante_id::text AS "estudianteId", t.expira_en AS "expiraEn",
         (t.usado_en IS NULL AND t.anulado_en IS NULL) AS abierto
    FROM app.token_correo t
    JOIN contenido.tipo_token_correo tt ON tt.id = t.tipo_token_correo_id
   WHERE tt.codigo = 'recuperacion' AND t.hash_token = $1`;

export function crearRecuperacionRepositorio(bd: Ejecutor): RecuperacionRepositorio {
  return {
    async buscarCuentaPorCorreo(correo, tx = bd) {
      const { rows } = await tx.query<CuentaDeRecuperacion>(
        `${SELECCION_CUENTA} WHERE lower(correo) = lower($1) AND eliminado_en IS NULL`,
        [correo],
      );
      return rows[0] ?? null;
    },

    async tipoRecuperacion(tx = bd) {
      const { rows } = await tx.query<{ id: number; horasVigencia: number }>(TIPO_RECUPERACION);
      const fila = rows[0];
      if (!fila) throw new Error('contenido.tipo_token_correo no tiene el tipo recuperacion.');
      return fila;
    },

    async insertarToken({ estudianteId, tipoId, hashToken, expiraEn }, tx = bd) {
      await tx.query(
        `INSERT INTO app.token_correo (estudiante_id, tipo_token_correo_id, hash_token, expira_en)
         VALUES ($1, $2, $3, $4)`,
        [estudianteId, tipoId, hashToken, expiraEn],
      );
    },

    async cuentaDelEnlace(hashToken, tx = bd) {
      const { rows } = await tx.query<{ estudianteId: string }>(SELECCION_TOKEN, [hashToken]);
      return rows[0]?.estudianteId ?? null;
    },

    async bloquearCuenta(id, tx = bd) {
      const { rows } = await tx.query<CuentaDeRecuperacion>(
        `${SELECCION_CUENTA} WHERE id = $1 AND eliminado_en IS NULL FOR UPDATE`,
        [id],
      );
      return rows[0] ?? null;
    },

    async bloquearToken(hashToken, tx = bd) {
      const { rows } = await tx.query<TokenRecuperacion>(`${SELECCION_TOKEN} FOR UPDATE OF t`, [
        hashToken,
      ]);
      return rows[0] ?? null;
    },

    async marcarTokenUsado(id, ahora, tx = bd) {
      await tx.query('UPDATE app.token_correo SET usado_en = $2 WHERE id = $1', [id, ahora]);
    },

    async actualizarContrasena(estudianteId, hashContrasena, tx = bd) {
      await tx.query('UPDATE app.estudiante SET hash_contrasena = $2 WHERE id = $1', [
        estudianteId,
        hashContrasena,
      ]);
    },
  };
}
