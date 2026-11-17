// Borrado de la cuenta (HU-08.1, RF-A18, RNF-09, CU-14 paso 6). Se eliminan el perfil y los puntajes, y
// el nombre, el correo y la contraseña se reemplazan: lo que rindió (evaluaciones, respuestas y
// resultados, que la base no deja borrar) y el historial de su suscripción (RN-17) quedan asociados a
// una cuenta sin datos personales, es decir, seudonimizados. Sus sesiones se revocan y sus permisos se
// retiran.
import type { Ejecutor } from '../../db/transaccion.js';

/** Seudónimo que reemplaza al nombre de una cuenta eliminada. */
export const NOMBRE_CUENTA_ELIMINADA = 'Cuenta eliminada';

const BLOQUEAR = `SELECT 1 FROM app.estudiante WHERE id = $1 AND eliminado_en IS NULL FOR UPDATE`;

// El perfil (pruebas, electivo e intereses) y los puntajes PAES se eliminan; los puntajes primero,
// porque apuntan a su permiso.
const BORRAR = [
  'DELETE FROM app.puntaje_paes WHERE estudiante_id = $1',
  'DELETE FROM app.estudiante_interes_carrera WHERE estudiante_id = $1',
  'DELETE FROM app.estudiante_prueba WHERE estudiante_id = $1',
];

// Sin sesiones abiertas ni enlaces o códigos de correo pendientes, y con los permisos retirados.
const CERRAR = [
  'UPDATE app.token_sesion SET revocado_en = $2 WHERE estudiante_id = $1 AND revocado_en IS NULL',
  `UPDATE app.token_correo SET anulado_en = $2
    WHERE estudiante_id = $1 AND usado_en IS NULL AND anulado_en IS NULL`,
  'UPDATE app.consentimiento SET revocado_en = $2 WHERE estudiante_id = $1 AND revocado_en IS NULL',
];

// El correo queda único e imposible de usar (dominio .invalid, RFC 2606), así la misma persona puede
// volver a registrarse con su correo. La contraseña deja de ser un hash válido.
const SEUDONIMIZAR = `
  UPDATE app.estudiante
     SET nombre = '${NOMBRE_CUENTA_ELIMINADA}', correo = 'eliminada-' || id || '@cuentas.invalid',
         hash_contrasena = '*', anio_egreso = NULL, curso_confirmado_en = NULL, eliminado_en = $2
   WHERE id = $1`;

export function crearEliminacionRepositorio() {
  return {
    /** Elimina la cuenta en la transacción `tx`. `false` si no existe o ya se eliminó. */
    async eliminar(estudianteId: string, ahora: Date, tx: Ejecutor): Promise<boolean> {
      const { rowCount } = await tx.query(BLOQUEAR, [estudianteId]);
      if (!rowCount) return false;
      for (const consulta of BORRAR) await tx.query(consulta, [estudianteId]);
      for (const consulta of [...CERRAR, SEUDONIMIZAR])
        await tx.query(consulta, [estudianteId, ahora]);
      return true;
    },
  };
}
