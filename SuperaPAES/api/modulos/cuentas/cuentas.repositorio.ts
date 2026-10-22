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
import type { Ejecutor } from '../../db/transaccion.js';

export type CuentasRepositorio = Record<string, never>;

/** @esqueleto Lo usará el servicio del módulo cuando implemente su primera consulta. */
export function crearCuentasRepositorio(_bd: Ejecutor): CuentasRepositorio {
  return {};
}
