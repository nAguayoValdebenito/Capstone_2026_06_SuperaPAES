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
// Las horas llegan del reloj del servicio, nunca de now(), para poder probar vencimientos.
import type { Audiencia } from '../../comun/jwt.js';
import { esRolCuentaInterna, type RolCuentaInterna } from '../../comun/roles.js';
import type { Ejecutor } from '../../db/transaccion.js';

/** Cuenta interna con lo necesario para el ingreso. El hash nunca sale del módulo. */
export interface CredencialesInternas {
  id: string;
  nombre: string;
  correo: string;
  rol: RolCuentaInterna;
  activo: boolean;
  hashContrasena: string;
}

/** Estudiante con lo necesario para el ingreso. El hash nunca sale del módulo. */
export interface CredencialesEstudiante {
  id: string;
  nombre: string;
  correo: string;
  correoVerificado: boolean;
  hashContrasena: string;
}

/**
 * Dueño de una sesión: un estudiante (app) o un usuario interno (consola), nunca los dos. El
 * dispositivo es la descripción que envió la app al ingresar; la renovación lo conserva.
 */
export interface DuenoSesion {
  tipo: Audiencia;
  cuentaId: string;
  dispositivo: string | null;
}

export interface NuevaSesion extends DuenoSesion {
  hashToken: string;
  expiraEn: Date;
}

export interface CuentasRepositorio {
  /** Busca por correo sin distinguir mayúsculas (índice ux_usuario_interno_correo sobre lower). */
  buscarCredencialesInternas(correo: string, tx?: Ejecutor): Promise<CredencialesInternas | null>;
  registrarAccesoInterno(id: string, ahora: Date, tx?: Ejecutor): Promise<void>;
  /**
   * Busca por correo sin distinguir mayúsculas. Una cuenta eliminada (eliminado_en con fecha) no se
   * encuentra: no entra y recibe el mismo rechazo que una contraseña incorrecta.
   */
  buscarCredencialesEstudiante(
    correo: string,
    tx?: Ejecutor,
  ): Promise<CredencialesEstudiante | null>;
  /** Devuelve el id de la nueva fila de app.token_sesion. */
  crearSesion(sesion: NuevaSesion, tx?: Ejecutor): Promise<string>;
  /**
   * Revoca la sesión abierta y vigente del token, del tipo indicado, en una sola sentencia (dos
   * renovaciones simultáneas no pueden usar el mismo token). Devuelve su dueño, o null.
   */
  consumirSesion(
    tipo: Audiencia,
    hashToken: string,
    ahora: Date,
    tx?: Ejecutor,
  ): Promise<DuenoSesion | null>;
  /** Cierra la sesión del token si sigue abierta; si no existe o ya estaba cerrada, no hace nada. */
  revocarSesion(tipo: Audiencia, hashToken: string, ahora: Date, tx?: Ejecutor): Promise<void>;
  revocarSesionesUsuarioInterno(id: string, ahora: Date, tx?: Ejecutor): Promise<void>;
  /** Sesión abierta, vigente y de esa cuenta interna, que además sigue activa y con ese rol. */
  sesionInternaVigente(
    sesionId: string,
    usuarioId: string,
    rol: RolCuentaInterna,
    ahora: Date,
  ): Promise<boolean>;
  /** Sesión abierta, vigente y de ese estudiante, cuya cuenta no fue eliminada. */
  sesionEstudianteVigente(sesionId: string, estudianteId: string, ahora: Date): Promise<boolean>;
}

interface FilaCredenciales extends Omit<CredencialesInternas, 'rol'> {
  rol: string;
}

const CREDENCIALES_INTERNAS = `
  SELECT u.id::text AS id, u.nombre, u.correo, r.codigo AS rol, u.activo,
         u.hash_contrasena AS "hashContrasena"
    FROM contenido.usuario_interno u
    JOIN contenido.rol r ON r.id = u.rol_id
   WHERE lower(u.correo) = lower($1)`;

const CREDENCIALES_ESTUDIANTE = `
  SELECT id::text AS id, nombre, correo, correo_verificado AS "correoVerificado",
         hash_contrasena AS "hashContrasena"
    FROM app.estudiante
   WHERE lower(correo) = lower($1) AND eliminado_en IS NULL`;

const INSERTAR_SESION = `
  INSERT INTO app.token_sesion (estudiante_id, usuario_interno_id, hash_token, dispositivo, expira_en)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING id::text AS id`;

// $3 indica el tipo: true para la consola (usuario interno), false para la app (estudiante, que además
// no debe haber sido eliminado: su sesión abierta no se renueva).
const CONSUMIR_SESION = `
  UPDATE app.token_sesion
     SET revocado_en = $2
   WHERE hash_token = $1 AND revocado_en IS NULL AND expira_en > $2
     AND (usuario_interno_id IS NOT NULL) = $3
     AND (usuario_interno_id IS NOT NULL OR EXISTS (
           SELECT 1 FROM app.estudiante e
            WHERE e.id = token_sesion.estudiante_id AND e.eliminado_en IS NULL))
  RETURNING COALESCE(usuario_interno_id, estudiante_id)::text AS "cuentaId", dispositivo`;

const REVOCAR_SESION = `
  UPDATE app.token_sesion
     SET revocado_en = $2
   WHERE hash_token = $1 AND revocado_en IS NULL AND (usuario_interno_id IS NOT NULL) = $3`;

const SESION_INTERNA_VIGENTE = `
  SELECT 1
    FROM app.token_sesion t
    JOIN contenido.usuario_interno u ON u.id = t.usuario_interno_id
    JOIN contenido.rol r ON r.id = u.rol_id
   WHERE t.id = $1 AND t.usuario_interno_id = $2 AND t.revocado_en IS NULL AND t.expira_en > $4
     AND u.activo AND r.codigo = $3`;

const SESION_ESTUDIANTE_VIGENTE = `
  SELECT 1
    FROM app.token_sesion t
    JOIN app.estudiante e ON e.id = t.estudiante_id
   WHERE t.id = $1 AND t.estudiante_id = $2 AND t.revocado_en IS NULL AND t.expira_en > $3
     AND e.eliminado_en IS NULL`;

/** Los ids que llegan de un token pueden no ser números: así no llegan a PostgreSQL como bigint inválido. */
const esId = (valor: string) => /^\d{1,18}$/.test(valor);

type Ingreso = Pick<
  CuentasRepositorio,
  'buscarCredencialesInternas' | 'registrarAccesoInterno' | 'buscarCredencialesEstudiante'
>;

function consultasIngreso(bd: Ejecutor): Ingreso {
  return {
    async buscarCredencialesInternas(correo, tx = bd) {
      const { rows } = await tx.query<FilaCredenciales>(CREDENCIALES_INTERNAS, [correo]);
      const fila = rows[0];
      if (!fila) return null;
      if (!esRolCuentaInterna(fila.rol)) {
        throw new Error(`contenido.rol tiene un código desconocido para la API: ${fila.rol}`);
      }
      return { ...fila, rol: fila.rol };
    },

    async registrarAccesoInterno(id, ahora, tx = bd) {
      await tx.query('UPDATE contenido.usuario_interno SET ultimo_acceso = $2 WHERE id = $1', [
        id,
        ahora,
      ]);
    },

    async buscarCredencialesEstudiante(correo, tx = bd) {
      const { rows } = await tx.query<CredencialesEstudiante>(CREDENCIALES_ESTUDIANTE, [correo]);
      return rows[0] ?? null;
    },
  };
}

function consultasSesiones(bd: Ejecutor): Omit<CuentasRepositorio, keyof Ingreso> {
  return {
    async crearSesion({ tipo, cuentaId, hashToken, dispositivo, expiraEn }, tx = bd) {
      const dueno = tipo === 'admin' ? [null, cuentaId] : [cuentaId, null];
      const { rows } = await tx.query<{ id: string }>(INSERTAR_SESION, [
        ...dueno,
        hashToken,
        dispositivo,
        expiraEn,
      ]);
      const fila = rows[0];
      if (!fila) throw new Error('El INSERT de token_sesion no devolvió el id.');
      return fila.id;
    },

    async consumirSesion(tipo, hashToken, ahora, tx = bd) {
      const { rows } = await tx.query<Omit<DuenoSesion, 'tipo'>>(CONSUMIR_SESION, [
        hashToken,
        ahora,
        tipo === 'admin',
      ]);
      const fila = rows[0];
      return fila ? { tipo, cuentaId: fila.cuentaId, dispositivo: fila.dispositivo } : null;
    },

    async revocarSesion(tipo, hashToken, ahora, tx = bd) {
      await tx.query(REVOCAR_SESION, [hashToken, ahora, tipo === 'admin']);
    },

    async revocarSesionesUsuarioInterno(id, ahora, tx = bd) {
      await tx.query(
        `UPDATE app.token_sesion SET revocado_en = $2
          WHERE usuario_interno_id = $1 AND revocado_en IS NULL`,
        [id, ahora],
      );
    },

    async sesionInternaVigente(sesionId, usuarioId, rol, ahora) {
      if (!esId(sesionId) || !esId(usuarioId)) return false;
      const { rows } = await bd.query(SESION_INTERNA_VIGENTE, [sesionId, usuarioId, rol, ahora]);
      return rows.length > 0;
    },

    async sesionEstudianteVigente(sesionId, estudianteId, ahora) {
      if (!esId(sesionId) || !esId(estudianteId)) return false;
      const { rows } = await bd.query(SESION_ESTUDIANTE_VIGENTE, [sesionId, estudianteId, ahora]);
      return rows.length > 0;
    },
  };
}

export function crearCuentasRepositorio(bd: Ejecutor): CuentasRepositorio {
  return { ...consultasIngreso(bd), ...consultasSesiones(bd) };
}
