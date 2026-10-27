// Módulo cupo-invitaciones: cupo diario de preguntas, usos gratis del mes, invitaciones y saldo de bonos.
// Exporta solo sus rutas y su servicio: los demás módulos lo usan a través del servicio.
export { crearRutasAppCupoInvitaciones } from './cupo-invitaciones.rutas.app.js';
export {
  crearCupoInvitacionesServicio,
  type CupoInvitacionesServicio,
  type EstadoCupo,
  type TipoConsumo,
} from './cupo-invitaciones.servicio.js';
