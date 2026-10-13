// Único lugar con SQL del módulo practica. Consultas siempre parametrizadas ($1, $2...).
// Tablas que pertenecen a este módulo (ningún otro módulo las escribe):
//   - app.sesion_practica
//   - app.entrega
//   - app.respuesta
//   - app.estadistica_pregunta
//   - vista contenido.v_preguntas_publicadas
//   - vista app.v_progreso_eje
//   - vista app.v_progreso_habilidad
// Cada método recibe un Ejecutor opcional (tx) para sumarse a la transacción del servicio.
import type { Ejecutor } from '../../db/transaccion.js';

export type PracticaRepositorio = Record<string, never>;

/** @esqueleto Lo usará el servicio del módulo cuando implemente su primera consulta. */
export function crearPracticaRepositorio(_bd: Ejecutor): PracticaRepositorio {
  return {};
}
