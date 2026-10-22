// Único lugar con SQL del módulo revision. Consultas siempre parametrizadas ($1, $2...).
// Tablas que pertenecen a este módulo (ningún otro módulo las escribe):
//   - contenido.asignacion_revision
//   - contenido.revision
//   - contenido.criterio_pauta
//   - contenido.revision_criterio
//   - vista contenido.v_calidad_criterio (calidad por criterio de la pauta; administracion la lee
//     por este servicio para el panel)
// Cada método recibe un Ejecutor opcional (tx) para sumarse a la transacción del servicio.
import type { Ejecutor } from '../../db/transaccion.js';

export type RevisionRepositorio = Record<string, never>;

/** @esqueleto Lo usará el servicio del módulo cuando implemente su primera consulta. */
export function crearRevisionRepositorio(_bd: Ejecutor): RevisionRepositorio {
  return {};
}
