// Módulo cuentas: registro, ingreso, verificación de correo y recuperación de contraseña de
// estudiantes, consentimientos, pruebas elegidas, áreas de carrera de interés, puntajes PAES
// declarados e ingreso del personal interno.
// Exporta solo sus rutas y su servicio: los demás módulos lo usan a través del servicio.
export { crearRutasAppCuentas } from './cuentas.rutas.app.js';
export { crearRutasAdminCuentas } from './cuentas.rutas.admin.js';
export { crearCuentasServicio, type CuentasServicio } from './cuentas.servicio.js';
