// Módulo preguntas: banco de preguntas, alternativas, versiones, textos de estímulo, importaciones
// y avisos de error de los estudiantes.
// Exporta solo sus rutas y su servicio: los demás módulos lo usan a través del servicio.
export { crearRutasAppPreguntas } from './preguntas.rutas.app.js';
export { crearRutasAdminPreguntas } from './preguntas.rutas.admin.js';
export { crearRutasRecursosPreguntas } from './preguntas.rutas.recursos.js';
export { crearPreguntasServicio, type PreguntasServicio } from './preguntas.servicio.js';
// Los filtros del banco (HU-11): revision los usa en el envío a revisión de 10 en 10.
export { esquemaFiltrosBanco } from './preguntas.validadores.js';
export { prepararBanco } from './preguntas.preparacion.servicio.js';
export type {
  EjemploDePregunta,
  PreguntaDeLote,
  PropuestaDeIa,
} from './preguntas.generacion.repositorio.js';
