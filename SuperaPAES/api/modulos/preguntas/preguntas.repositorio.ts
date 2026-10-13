// Único lugar con SQL del módulo preguntas. Consultas siempre parametrizadas ($1, $2...).
// Tablas que pertenecen a este módulo (ningún otro módulo las escribe):
//   - contenido.pregunta
//   - contenido.alternativa
//   - contenido.pregunta_version
//   - contenido.texto_estimulo
//   - contenido.importacion
//   - app.reporte_pregunta
// Cada método recibe un Ejecutor opcional (tx) para sumarse a la transacción del servicio.
import type { Ejecutor } from '../../db/transaccion.js';

export type PreguntasRepositorio = Record<string, never>;

/** @esqueleto Lo usará el servicio del módulo cuando implemente su primera consulta. */
export function crearPreguntasRepositorio(_bd: Ejecutor): PreguntasRepositorio {
  return {};
}
