// Único lugar con SQL del módulo temario. Consultas siempre parametrizadas ($1, $2...).
// Tablas que pertenecen a este módulo (ningún otro módulo las escribe):
//   - contenido.area
//   - contenido.prueba
//   - contenido.prueba_tipo_pregunta
//   - contenido.eje_tematico
//   - contenido.contenido_tematico
//   - contenido.habilidad
//   - contenido.area_carrera_prueba (pruebas y electivo que sugiere cada área de carrera)
// Cada método recibe un Ejecutor opcional (tx) para sumarse a la transacción del servicio.
import type { Ejecutor } from '../../db/transaccion.js';

export type TemarioRepositorio = Record<string, never>;

/** @esqueleto Lo usará el servicio del módulo cuando implemente su primera consulta. */
export function crearTemarioRepositorio(_bd: Ejecutor): TemarioRepositorio {
  return {};
}
