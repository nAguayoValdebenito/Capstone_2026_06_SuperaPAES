// Módulo preguntas: banco de preguntas, alternativas, versiones, textos de estímulo, importaciones
// y avisos de error de los estudiantes.
// Exporta solo sus rutas y su servicio: los demás módulos lo usan a través del servicio.
export { crearRutasAppPreguntas } from './preguntas.rutas.app.js';
export { crearRutasAdminPreguntas } from './preguntas.rutas.admin.js';
export { crearPreguntasServicio, type PreguntasServicio } from './preguntas.servicio.js';
