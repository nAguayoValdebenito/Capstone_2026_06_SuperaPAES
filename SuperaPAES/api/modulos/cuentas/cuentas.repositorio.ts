// Único lugar con SQL del módulo cuentas. Consultas siempre parametrizadas ($1, $2...).
// Tablas que pertenecen a este módulo (ningún otro módulo las escribe):
//   - app.estudiante
//   - app.token_sesion (sesiones de estudiantes y del personal interno)
//   - app.token_correo
//   - app.consentimiento
//   - app.estudiante_prueba
//   - app.estudiante_interes_carrera
//   - app.puntaje_paes
//   - contenido.usuario_interno (solo el ingreso: último acceso)
// Cada método recibe un Ejecutor opcional (tx) para sumarse a la transacción del servicio.
// Las fechas de vencimiento las calcula la base con now(), la hora de la transacción.
import type { Ejecutor } from '../../db/transaccion.js';

/** Lo que el ingreso de la consola necesita de una cuenta interna. El rol es el código de contenido.rol. */
export interface CuentaParaIngreso {
  id: string;
  rol: string;
  activo: boolean;
  hashContrasena: string;
}

/** Sesión de la consola (app.token_sesion) con el estado actual de su cuenta. */
export interface SesionInterna {
  id: string;
  usuarioInternoId: string;
  rol: string;
  activo: boolean;
  vigente: boolean;
}

export interface NuevaSesionInterna {
  usuarioInternoId: string;
  hashToken: string;
  horasVigencia: number;
  dispositivo: string | null;
}

export interface CuentasRepositorio {
  buscarCuentaInternaPorCorreo(correo: string, tx?: Ejecutor): Promise<CuentaParaIngreso | null>;
  registrarAccesoInterno(id: string, tx?: Ejecutor): Promise<void>;
  crearSesionInterna(sesion: NuevaSesionInterna, tx?: Ejecutor): Promise<void>;
  /** Bloquea la fila (FOR UPDATE): dos renovaciones con la misma credencial no la usan dos veces. */
  buscarSesionInterna(hashToken: string, tx?: Ejecutor): Promise<SesionInterna | null>;
  /** Marca el cierre; si ya estaba cerrada, no la cambia. */
  revocarSesion(id: string, tx?: Ejecutor): Promise<void>;
}

const CUENTA_POR_CORREO = `
  SELECT u.id::text AS id, r.codigo AS rol, u.activo, u.hash_contrasena AS "hashContrasena"
    FROM contenido.usuario_interno u
    JOIN contenido.rol r ON r.id = u.rol_id
   WHERE lower(u.correo) = lower($1)`;

const INSERTAR_SESION_INTERNA = `
  INSERT INTO app.token_sesion (usuario_interno_id, hash_token, dispositivo, expira_en)
  VALUES ($1, $2, $3, now() + make_interval(hours => $4))`;

const SESION_INTERNA = `
  SELECT t.id::text AS id, u.id::text AS "usuarioInternoId", r.codigo AS rol, u.activo,
         (t.revocado_en IS NULL AND t.expira_en > now()) AS vigente
    FROM app.token_sesion t
    JOIN contenido.usuario_interno u ON u.id = t.usuario_interno_id
    JOIN contenido.rol r ON r.id = u.rol_id
   WHERE t.hash_token = $1
     FOR UPDATE OF t`;

export function crearCuentasRepositorio(bd: Ejecutor): CuentasRepositorio {
  return {
    async buscarCuentaInternaPorCorreo(correo, tx = bd) {
      const { rows } = await tx.query<CuentaParaIngreso>(CUENTA_POR_CORREO, [correo]);
      return rows[0] ?? null;
    },

    async registrarAccesoInterno(id, tx = bd) {
      await tx.query('UPDATE contenido.usuario_interno SET ultimo_acceso = now() WHERE id = $1', [
        id,
      ]);
    },

    async crearSesionInterna({ usuarioInternoId, hashToken, horasVigencia, dispositivo }, tx = bd) {
      await tx.query(INSERTAR_SESION_INTERNA, [
        usuarioInternoId,
        hashToken,
        dispositivo,
        horasVigencia,
      ]);
    },

    async buscarSesionInterna(hashToken, tx = bd) {
      const { rows } = await tx.query<SesionInterna>(SESION_INTERNA, [hashToken]);
      return rows[0] ?? null;
    },

    async revocarSesion(id, tx = bd) {
      await tx.query(
        'UPDATE app.token_sesion SET revocado_en = now() WHERE id = $1 AND revocado_en IS NULL',
        [id],
      );
    },
  };
}
