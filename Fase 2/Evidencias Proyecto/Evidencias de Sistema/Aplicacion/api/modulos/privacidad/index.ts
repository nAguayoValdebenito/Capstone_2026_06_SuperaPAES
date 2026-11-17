// Módulo privacidad: solicitudes de derechos sobre datos personales (Ley 21.719), exportación y
// borrado de la cuenta con seudonimización.
// Exporta solo sus rutas y su servicio: los demás módulos lo usan a través del servicio.
export { crearRutasAppPrivacidad } from './privacidad.rutas.app.js';
export { crearRutasAdminPrivacidad } from './privacidad.rutas.admin.js';
export { crearPrivacidadServicio, type PrivacidadServicio } from './privacidad.servicio.js';
