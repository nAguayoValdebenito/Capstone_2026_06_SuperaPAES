// Lo que la descarga de datos (HU-07.1, RF-A18) toma de la cuenta: sus datos y cada documento legal que
// aceptó, con su versión. El tipo y la versión del documento se leen de contenido, como lo hace el
// registro al validar lo aceptado.
import type { Ejecutor } from '../../db/transaccion.js';

/** La cuenta sin el hash de la contraseña. */
export interface CuentaExportada {
  id: string;
  nombre: string;
  correo: string;
  correoVerificado: boolean;
  verificadoEn: Date | null;
  codigoInvitacion: string;
  creadoEn: Date;
}

export interface ConsentimientoExportado {
  /** Código de contenido.tipo_documento_legal: terminos, privacidad o puntajes. */
  documento: string;
  version: string;
  aceptadoEn: Date;
  revocadoEn: Date | null;
}

const CUENTA = `
  SELECT id::text AS id, nombre, correo, correo_verificado AS "correoVerificado",
         verificado_en AS "verificadoEn", codigo_invitacion AS "codigoInvitacion",
         creado_en AS "creadoEn"
    FROM app.estudiante
   WHERE id = $1 AND eliminado_en IS NULL`;

const CONSENTIMIENTOS = `
  SELECT t.codigo AS documento, d.version, c.aceptado_en AS "aceptadoEn",
         c.revocado_en AS "revocadoEn"
    FROM app.consentimiento c
    JOIN contenido.documento_legal d ON d.id = c.documento_legal_id
    JOIN contenido.tipo_documento_legal t ON t.id = d.tipo_documento_legal_id
   WHERE c.estudiante_id = $1
   ORDER BY c.aceptado_en, c.id`;

export function crearExportacionRepositorio(bd: Ejecutor) {
  return {
    /** null si la cuenta no existe o se eliminó. */
    async cuenta(estudianteId: string, tx: Ejecutor = bd): Promise<CuentaExportada | null> {
      const { rows } = await tx.query<CuentaExportada>(CUENTA, [estudianteId]);
      return rows[0] ?? null;
    },

    async consentimientos(
      estudianteId: string,
      tx: Ejecutor = bd,
    ): Promise<ConsentimientoExportado[]> {
      const { rows } = await tx.query<ConsentimientoExportado>(CONSENTIMIENTOS, [estudianteId]);
      return rows;
    },
  };
}
