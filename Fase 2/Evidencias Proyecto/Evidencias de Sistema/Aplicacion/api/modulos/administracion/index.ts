// Módulo administracion: gestión de usuarios internos y especialidades, parámetros del sistema
// (contenido.configuracion), documentos legales, auditoría, panel de métricas y consulta de estudiantes.
// Exporta solo sus rutas y su servicio: los demás módulos lo usan a través del servicio.
export { crearRutasAdminAdministracion } from './administracion.rutas.admin.js';
export {
  crearAdministracionServicio,
  type AdministracionServicio,
  type DocumentoLegalVigente,
} from './administracion.servicio.js';
