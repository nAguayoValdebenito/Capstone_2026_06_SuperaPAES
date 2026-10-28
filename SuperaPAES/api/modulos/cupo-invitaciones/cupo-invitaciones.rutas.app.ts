// Rutas de /api/v1/app/cupo-invitaciones (estudiante autenticado con el JWT de la app): cupo diario de
// preguntas, usos gratis del mes, invitaciones y saldo de bonos. La autenticación la aplica app.ts antes de montar este router.
import { Router } from 'express';
import type { MiddlewareRutas } from '../../comun/middleware/index.js';
import { validar } from '../../comun/middleware/validacion.js';
import { crearCupoInvitacionesControlador } from './cupo-invitaciones.controlador.js';
import type { CupoInvitacionesServicio } from './cupo-invitaciones.servicio.js';
import { esquemaCodigoInvitacion } from './cupo-invitaciones.validadores.js';

export function crearRutasAppCupoInvitaciones(
  servicio: CupoInvitacionesServicio,
  mw: Pick<MiddlewareRutas, 'crearLimiteIntentos'>,
): Router {
  const router = Router();
  const controlador = crearCupoInvitacionesControlador(servicio);

  // HU-35.1: cupo del día, saldo de preguntas extra, próximo reinicio y racha para el inicio (A12).
  router.get('/cupo', controlador.cupoDeHoy);
  router.post(
    '/invitaciones',
    validar({ cuerpo: esquemaCodigoInvitacion }),
    mw.crearLimiteIntentos({ porEstudiante: true }),
    controlador.registrarCodigo,
  );
  return router;
}
