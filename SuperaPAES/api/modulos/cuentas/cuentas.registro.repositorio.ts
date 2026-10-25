// SQL del registro del estudiante (HU-01, CU-01) del módulo cuentas, aparte de cuentas.repositorio.ts
// para que cada archivo quede corto. Consultas siempre parametrizadas. Escribe tablas de cuentas
// (app.estudiante y app.consentimiento). Cada método recibe un Ejecutor opcional (tx) para sumarse a la
// transacción del servicio; las horas llegan del reloj del servicio.
import type { Ejecutor } from '../../db/transaccion.js';

export interface NuevoEstudiante {
  nombre: string;
  /** Ya sin espacios y en minúsculas. */
  correo: string;
  hashContrasena: string;
  codigoInvitacion: string;
  creadoEn: Date;
}

export interface RegistroRepositorio {
  /**
   * Crea la cuenta sin verificar y devuelve su id. Un correo repetido viola ux_estudiante_correo y un
   * código de invitación repetido viola estudiante_codigo_invitacion_key: el servicio los traduce.
   */
  insertarEstudiante(estudiante: NuevoEstudiante, tx?: Ejecutor): Promise<string>;
  /** Un consentimiento por documento legal aceptado, con su fecha (RN-18, RN-30). */
  insertarConsentimientos(
    estudianteId: string,
    documentos: readonly number[],
    aceptadoEn: Date,
    tx?: Ejecutor,
  ): Promise<void>;
  /** Estudiante dueño de un código de invitación (sin las cuentas eliminadas), o null. */
  buscarInvitantePorCodigo(codigo: string, tx?: Ejecutor): Promise<string | null>;
}

const INSERTAR_ESTUDIANTE = `
  INSERT INTO app.estudiante (nombre, correo, hash_contrasena, codigo_invitacion, creado_en)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING id::text AS id`;

const INSERTAR_CONSENTIMIENTOS = `
  INSERT INTO app.consentimiento (estudiante_id, documento_legal_id, aceptado_en)
  SELECT $1, unnest($2::smallint[]), $3`;

export function crearRegistroRepositorio(bd: Ejecutor): RegistroRepositorio {
  return {
    async insertarEstudiante(
      { nombre, correo, hashContrasena, codigoInvitacion, creadoEn },
      tx = bd,
    ) {
      const { rows } = await tx.query<{ id: string }>(INSERTAR_ESTUDIANTE, [
        nombre,
        correo,
        hashContrasena,
        codigoInvitacion,
        creadoEn,
      ]);
      const fila = rows[0];
      if (!fila) throw new Error('El INSERT de estudiante no devolvió el id.');
      return fila.id;
    },

    async insertarConsentimientos(estudianteId, documentos, aceptadoEn, tx = bd) {
      await tx.query(INSERTAR_CONSENTIMIENTOS, [estudianteId, documentos, aceptadoEn]);
    },

    async buscarInvitantePorCodigo(codigo, tx = bd) {
      const { rows } = await tx.query<{ id: string }>(
        `SELECT id::text AS id FROM app.estudiante
          WHERE codigo_invitacion = $1 AND eliminado_en IS NULL`,
        [codigo],
      );
      return rows[0]?.id ?? null;
    },
  };
}
