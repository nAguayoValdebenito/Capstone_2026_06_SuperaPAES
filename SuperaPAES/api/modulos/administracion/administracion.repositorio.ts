// Único lugar con SQL del módulo administracion. Consultas siempre parametrizadas ($1, $2...).
// Tablas que pertenecen a este módulo (ningún otro módulo las escribe):
//   - contenido.usuario_interno (gestión)
//   - contenido.docente_especialidad
//   - contenido.configuracion
//   - contenido.auditoria
//   - contenido.documento_legal (versiones que publica el administrador)
// Cada método recibe un Ejecutor opcional (tx) para sumarse a la transacción del servicio.
// El rol y la acción de auditoría se buscan por su código, nunca por su id.
import { esRolCuentaInterna, type RolCuentaInterna } from '../../comun/roles.js';
import type { Ejecutor } from '../../db/transaccion.js';

/** Cuenta interna tal como la ve la consola. Nunca lleva la contraseña ni su hash. */
export interface UsuarioInterno {
  id: string;
  nombre: string;
  correo: string;
  rol: RolCuentaInterna;
  activo: boolean;
  /** Ids de contenido.area que puede revisar (solo docentes). */
  areas: number[];
  creadoEn: Date;
  ultimoAcceso: Date | null;
}

export interface NuevoUsuarioInterno {
  nombre: string;
  correo: string;
  rol: RolCuentaInterna;
  hashContrasena: string;
}

export interface CambiosUsuarioInterno {
  nombre: string;
  rol: RolCuentaInterna;
  /** Hash de la contraseña nueva; null si no cambia. */
  hashContrasena: string | null;
}

export interface EntradaAuditoria {
  usuarioId: string;
  /** Código de contenido.accion_auditoria, por ejemplo crear_usuario. */
  accion: string;
  entidad: string;
  entidadId: string;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
}

export interface AdministracionRepositorio {
  listarUsuariosInternos(tx?: Ejecutor): Promise<UsuarioInterno[]>;
  /** Con `bloquear`, bloquea la fila hasta el fin de la transacción (FOR UPDATE). */
  buscarUsuarioInterno(
    id: string,
    bloquear: boolean,
    tx?: Ejecutor,
  ): Promise<UsuarioInterno | null>;
  crearUsuarioInterno(datos: NuevoUsuarioInterno, tx?: Ejecutor): Promise<string>;
  actualizarUsuarioInterno(
    id: string,
    cambios: CambiosUsuarioInterno,
    tx?: Ejecutor,
  ): Promise<void>;
  cambiarActivoUsuarioInterno(id: string, activo: boolean, tx?: Ejecutor): Promise<void>;
  reemplazarEspecialidades(id: string, areas: readonly number[], tx?: Ejecutor): Promise<void>;
  registrarAuditoria(entrada: EntradaAuditoria, tx?: Ejecutor): Promise<void>;
}

interface FilaUsuarioInterno extends Omit<UsuarioInterno, 'rol'> {
  rol: string;
}

const SELECCION_USUARIO_INTERNO = `
  SELECT u.id::text AS id, u.nombre, u.correo, r.codigo AS rol, u.activo,
         u.creado_en AS "creadoEn", u.ultimo_acceso AS "ultimoAcceso",
         COALESCE(array_agg(de.area_id ORDER BY de.area_id) FILTER (WHERE de.area_id IS NOT NULL),
                  '{}') AS areas
    FROM contenido.usuario_interno u
    JOIN contenido.rol r ON r.id = u.rol_id
    LEFT JOIN contenido.docente_especialidad de ON de.usuario_interno_id = u.id`;

function aUsuarioInterno({ rol, ...resto }: FilaUsuarioInterno): UsuarioInterno {
  if (!esRolCuentaInterna(rol)) {
    throw new Error(`contenido.rol tiene un código desconocido para la API: ${rol}`);
  }
  return { ...resto, rol };
}

const INSERTAR_USUARIO_INTERNO = `
  INSERT INTO contenido.usuario_interno (nombre, correo, hash_contrasena, rol_id, creado_en)
  VALUES ($1, $2, $3, (SELECT id FROM contenido.rol WHERE codigo = $4), now())
  RETURNING id::text AS id`;

const ACTUALIZAR_USUARIO_INTERNO = `
  UPDATE contenido.usuario_interno
     SET nombre = $2, rol_id = (SELECT id FROM contenido.rol WHERE codigo = $3),
         hash_contrasena = COALESCE($4, hash_contrasena)
   WHERE id = $1`;

const INSERTAR_AUDITORIA = `
  INSERT INTO contenido.auditoria (usuario_id, accion_auditoria_id, entidad, entidad_id, antes,
                                   despues, creado_en)
  VALUES ($1, (SELECT id FROM contenido.accion_auditoria WHERE codigo = $2), $3, $4, $5, $6, now())`;

type ConsultasUsuarios = Pick<
  AdministracionRepositorio,
  'listarUsuariosInternos' | 'buscarUsuarioInterno' | 'crearUsuarioInterno'
>;

function consultasUsuarios(bd: Ejecutor): ConsultasUsuarios {
  return {
    async listarUsuariosInternos(tx = bd) {
      const { rows } = await tx.query<FilaUsuarioInterno>(
        `${SELECCION_USUARIO_INTERNO} GROUP BY u.id, r.codigo ORDER BY u.nombre, u.id`,
      );
      return rows.map(aUsuarioInterno);
    },

    async buscarUsuarioInterno(id, bloquear, tx = bd) {
      if (bloquear) {
        await tx.query('SELECT 1 FROM contenido.usuario_interno WHERE id = $1 FOR UPDATE', [id]);
      }
      const { rows } = await tx.query<FilaUsuarioInterno>(
        `${SELECCION_USUARIO_INTERNO} WHERE u.id = $1 GROUP BY u.id, r.codigo`,
        [id],
      );
      const fila = rows[0];
      return fila ? aUsuarioInterno(fila) : null;
    },

    async crearUsuarioInterno(datos, tx = bd) {
      const { rows } = await tx.query<{ id: string }>(INSERTAR_USUARIO_INTERNO, [
        datos.nombre,
        datos.correo,
        datos.hashContrasena,
        datos.rol,
      ]);
      const fila = rows[0];
      if (!fila) throw new Error('El INSERT de usuario_interno no devolvió el id.');
      return fila.id;
    },
  };
}

type CambiosYAuditoria = Omit<AdministracionRepositorio, keyof ConsultasUsuarios>;

function cambiosYAuditoria(bd: Ejecutor): CambiosYAuditoria {
  return {
    async actualizarUsuarioInterno(id, { nombre, rol, hashContrasena }, tx = bd) {
      await tx.query(ACTUALIZAR_USUARIO_INTERNO, [id, nombre, rol, hashContrasena]);
    },

    async cambiarActivoUsuarioInterno(id, activo, tx = bd) {
      await tx.query('UPDATE contenido.usuario_interno SET activo = $2 WHERE id = $1', [
        id,
        activo,
      ]);
    },

    async reemplazarEspecialidades(id, areas, tx = bd) {
      await tx.query('DELETE FROM contenido.docente_especialidad WHERE usuario_interno_id = $1', [
        id,
      ]);
      if (areas.length === 0) return;
      await tx.query(
        `INSERT INTO contenido.docente_especialidad (usuario_interno_id, area_id)
         SELECT $1, unnest($2::smallint[])`,
        [id, areas],
      );
    },

    async registrarAuditoria(entrada, tx = bd) {
      const { usuarioId, accion, entidad, entidadId, antes, despues } = entrada;
      await tx.query(INSERTAR_AUDITORIA, [usuarioId, accion, entidad, entidadId, antes, despues]);
    },
  };
}

export function crearAdministracionRepositorio(bd: Ejecutor): AdministracionRepositorio {
  return { ...consultasUsuarios(bd), ...cambiosYAuditoria(bd) };
}
