// SQL de la verificación del correo (HU-05, RN-32, CU-02 y CU-02b) del módulo cuentas, aparte de
// cuentas.repositorio.ts para que cada archivo quede corto. Consultas siempre parametrizadas.
// Escribe tablas de cuentas (app.token_correo y app.estudiante) y lee contenido.tipo_token_correo por
// su código, nunca por su id. Cada método recibe un Ejecutor opcional (tx) para sumarse a la
// transacción del servicio. Las horas llegan del reloj del servicio; solo el trigger tg_token_correo
// usa now() al anular el correo anterior cuando se emite uno nuevo.
import type { Ejecutor } from '../../db/transaccion.js';

/** Estudiante tal como lo ven la verificación y la consola (C15). Nunca lleva el hash. */
export interface EstudianteVerificable {
  id: string;
  nombre: string;
  correo: string;
  correoVerificado: boolean;
  creadoEn: Date;
}

/** Vigencia e intentos del correo de verificación (contenido.tipo_token_correo, código verificacion). */
export interface TipoVerificacion {
  id: number;
  horasVigencia: number;
  intentosCodigo: number;
}

export interface TokenVerificacion {
  id: string;
  estudianteId: string;
  hashToken: string;
  hashCodigo: string;
  expiraEn: Date;
  /** Sin usar y sin anular (no considera el vencimiento, que depende del reloj). */
  abierto: boolean;
  intentosFallidos: number;
  intentosCodigo: number;
}

export interface NuevoTokenVerificacion {
  estudianteId: string;
  tipoId: number;
  hashToken: string;
  hashCodigo: string;
  expiraEn: Date;
}

export interface VerificacionRepositorio {
  /** Bloquea al estudiante (FOR UPDATE) hasta el fin de la transacción. Una cuenta eliminada no está. */
  bloquearEstudiante(id: string, tx?: Ejecutor): Promise<EstudianteVerificable | null>;
  /** Por correo, sin distinguir mayúsculas, sin las cuentas eliminadas. */
  buscarEstudiantesPorCorreo(correo: string, tx?: Ejecutor): Promise<EstudianteVerificable[]>;
  tipoVerificacion(tx?: Ejecutor): Promise<TipoVerificacion>;
  /** El trigger tg_token_correo anula el correo de verificación anterior del estudiante (RN-32). */
  insertarToken(token: NuevoTokenVerificacion, tx?: Ejecutor): Promise<void>;
  /** Dueño del enlace de verificación, sin bloquear (para bloquear primero al estudiante). */
  estudianteDelEnlace(hashToken: string, tx?: Ejecutor): Promise<string | null>;
  /** Bloquea el correo de verificación del enlace (FOR UPDATE), esté o no vigente. */
  bloquearTokenPorHash(hashToken: string, tx?: Ejecutor): Promise<TokenVerificacion | null>;
  marcarTokenUsado(id: string, ahora: Date, tx?: Ejecutor): Promise<void>;
  /** Anula el correo de verificación pendiente del estudiante, si lo hay (CU-02b). */
  anularVerificacionPendiente(estudianteId: string, ahora: Date, tx?: Ejecutor): Promise<void>;
  marcarCorreoVerificado(id: string, ahora: Date, tx?: Ejecutor): Promise<void>;
}

const SELECCION_ESTUDIANTE = `
  SELECT id::text AS id, nombre, correo, correo_verificado AS "correoVerificado",
         creado_en AS "creadoEn"
    FROM app.estudiante`;

const TIPO_VERIFICACION = `
  SELECT id, horas_vigencia AS "horasVigencia", intentos_codigo AS "intentosCodigo"
    FROM contenido.tipo_token_correo
   WHERE codigo = 'verificacion'`;

const SELECCION_TOKEN = `
  SELECT t.id::text AS id, t.estudiante_id::text AS "estudianteId", t.hash_token AS "hashToken",
         t.hash_codigo AS "hashCodigo", t.expira_en AS "expiraEn",
         (t.usado_en IS NULL AND t.anulado_en IS NULL) AS abierto,
         t.intentos_fallidos AS "intentosFallidos", tt.intentos_codigo AS "intentosCodigo"
    FROM app.token_correo t
    JOIN contenido.tipo_token_correo tt ON tt.id = t.tipo_token_correo_id
   WHERE tt.codigo = 'verificacion'`;

const INSERTAR_TOKEN = `
  INSERT INTO app.token_correo (estudiante_id, tipo_token_correo_id, hash_token, hash_codigo, expira_en)
  VALUES ($1, $2, $3, $4, $5)`;

const ANULAR_PENDIENTE = `
  UPDATE app.token_correo t
     SET anulado_en = $2
    FROM contenido.tipo_token_correo tt
   WHERE tt.id = t.tipo_token_correo_id AND tt.codigo = 'verificacion'
     AND t.estudiante_id = $1 AND t.usado_en IS NULL AND t.anulado_en IS NULL`;

type Estudiantes = Pick<
  VerificacionRepositorio,
  'bloquearEstudiante' | 'buscarEstudiantesPorCorreo' | 'marcarCorreoVerificado'
>;

function consultasEstudiantes(bd: Ejecutor): Estudiantes {
  return {
    async bloquearEstudiante(id, tx = bd) {
      const { rows } = await tx.query<EstudianteVerificable>(
        `${SELECCION_ESTUDIANTE} WHERE id = $1 AND eliminado_en IS NULL FOR UPDATE`,
        [id],
      );
      return rows[0] ?? null;
    },

    async buscarEstudiantesPorCorreo(correo, tx = bd) {
      const { rows } = await tx.query<EstudianteVerificable>(
        `${SELECCION_ESTUDIANTE} WHERE lower(correo) = lower($1) AND eliminado_en IS NULL ORDER BY id`,
        [correo],
      );
      return rows;
    },

    async marcarCorreoVerificado(id, ahora, tx = bd) {
      await tx.query(
        'UPDATE app.estudiante SET correo_verificado = true, verificado_en = $2 WHERE id = $1',
        [id, ahora],
      );
    },
  };
}

function consultasTokens(bd: Ejecutor): Omit<VerificacionRepositorio, keyof Estudiantes> {
  return {
    async tipoVerificacion(tx = bd) {
      const { rows } = await tx.query<TipoVerificacion>(TIPO_VERIFICACION);
      const fila = rows[0];
      if (!fila?.intentosCodigo) {
        throw new Error('contenido.tipo_token_correo no tiene el tipo verificacion con su código.');
      }
      return fila;
    },

    async insertarToken({ estudianteId, tipoId, hashToken, hashCodigo, expiraEn }, tx = bd) {
      await tx.query(INSERTAR_TOKEN, [estudianteId, tipoId, hashToken, hashCodigo, expiraEn]);
    },

    async estudianteDelEnlace(hashToken, tx = bd) {
      const { rows } = await tx.query<{ estudianteId: string }>(
        `${SELECCION_TOKEN} AND t.hash_token = $1`,
        [hashToken],
      );
      return rows[0]?.estudianteId ?? null;
    },

    async bloquearTokenPorHash(hashToken, tx = bd) {
      const { rows } = await tx.query<TokenVerificacion>(
        `${SELECCION_TOKEN} AND t.hash_token = $1 FOR UPDATE OF t`,
        [hashToken],
      );
      return rows[0] ?? null;
    },

    async marcarTokenUsado(id, ahora, tx = bd) {
      await tx.query('UPDATE app.token_correo SET usado_en = $2 WHERE id = $1', [id, ahora]);
    },

    async anularVerificacionPendiente(estudianteId, ahora, tx = bd) {
      await tx.query(ANULAR_PENDIENTE, [estudianteId, ahora]);
    },
  };
}

export function crearVerificacionRepositorio(bd: Ejecutor): VerificacionRepositorio {
  return { ...consultasEstudiantes(bd), ...consultasTokens(bd) };
}
