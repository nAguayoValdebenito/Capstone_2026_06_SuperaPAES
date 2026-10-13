// Módulo generador: lotes de generación de preguntas con IA (la cola la consume el worker de trabajos/).
// Exporta solo sus rutas y su servicio: los demás módulos lo usan a través del servicio.
export { crearRutasAdminGenerador } from './generador.rutas.admin.js';
export { crearGeneradorServicio, type GeneradorServicio } from './generador.servicio.js';
