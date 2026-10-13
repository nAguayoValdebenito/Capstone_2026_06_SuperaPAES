// Rutas de /api/v1/admin/cuentas: ingreso del personal interno (pública, con límite de intentos).
// Las rutas de sesión que se agreguen aquí llevan mw.autenticarAdmin en su cadena, porque este router
// se monta antes de la autenticación general de /admin.
import { Router } from 'express';
import type { MiddlewareRutas } from '../../comun/middleware/index.js';
import { validar } from '../../comun/middleware/validacion.js';
import { crearCuentasControlador } from './cuentas.controlador.js';
import type { CuentasServicio } from './cuentas.servicio.js';
import { esquemaIngreso } from './cuentas.validadores.js';

export function crearRutasAdminCuentas(servicio: CuentasServicio, mw: MiddlewareRutas): Router {
  const router = Router();
  const controlador = crearCuentasControlador(servicio);

  router.post(
    '/ingreso',
    validar({ cuerpo: esquemaIngreso }),
    mw.crearLimiteIntentos({ soloFallidos: true }),
    controlador.ingresarConsola,
  );
  return router;
}
