// Único lugar con SQL del módulo administracion. Consultas siempre parametrizadas ($1, $2...).
// Tablas que pertenecen a este módulo (ningún otro módulo las escribe):
//   - contenido.usuario_interno (gestión)
//   - contenido.docente_especialidad
//   - contenido.configuracion
//   - contenido.auditoria
//   - contenido.documento_legal (versiones que publica el administrador)
// Cada método recibe un Ejecutor opcional (tx) para sumarse a la transacción del servicio.
import type { Ejecutor } from '../../db/transaccion.js';

export type AdministracionRepositorio = Record<string, never>;

/** @esqueleto Lo usará el servicio del módulo cuando implemente su primera consulta. */
export function crearAdministracionRepositorio(_bd: Ejecutor): AdministracionRepositorio {
  return {};
}
