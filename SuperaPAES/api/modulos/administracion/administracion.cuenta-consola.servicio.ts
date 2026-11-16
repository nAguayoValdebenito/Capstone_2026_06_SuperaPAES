// Lo que la sesión de la consola necesita de una cuenta interna, en el módulo administracion (dueño de
// usuario_interno y de la auditoría): su estado en cada petición y guardar la contraseña que la persona
// eligió. administracion.servicio.ts los expone en su servicio.
import type { EstadoCuentaInterna } from '../../comun/middleware/autenticacion.js';
import type { RolCuentaInterna } from '../../comun/roles.js';
import type { Ejecutor } from '../../db/transaccion.js';
import type { AdministracionRepositorio } from './administracion.repositorio.js';

/** El id de usuario_interno es BIGINT: un sub que no es un número no corresponde a ninguna cuenta. */
const ID_USUARIO_INTERNO = /^[1-9]\d{0,17}$/;

type Repositorio = Pick<
  AdministracionRepositorio,
  'buscarRolActivo' | 'guardarContrasenaPropia' | 'registrarAuditoria'
>;

/** Una sola consulta: si la cuenta sigue vigente con ese rol y si tiene un cambio de contraseña pendiente. */
export async function estadoCuenta(
  repositorio: Repositorio,
  id: string,
  rol: RolCuentaInterna,
): Promise<EstadoCuentaInterna> {
  if (!ID_USUARIO_INTERNO.test(id)) return 'no_vigente';
  const cuenta = await repositorio.buscarRolActivo(id);
  if (!cuenta?.activo || cuenta.rol !== rol) return 'no_vigente';
  return cuenta.debeCambiarContrasena ? 'cambio_pendiente' : 'vigente';
}

/** Guarda el hash, quita la marca y lo audita (sin la contraseña ni el hash) en la transacción `tx`. */
export async function guardarContrasenaPropia(
  repositorio: Repositorio,
  id: string,
  hashContrasena: string,
  tx: Ejecutor,
): Promise<void> {
  await repositorio.guardarContrasenaPropia(id, hashContrasena, tx);
  await repositorio.registrarAuditoria(
    {
      usuarioId: id,
      accion: 'cambiar_contrasena',
      entidad: 'usuario_interno',
      entidadId: id,
      antes: null,
      despues: { contrasena_cambiada: true },
    },
    tx,
  );
}
