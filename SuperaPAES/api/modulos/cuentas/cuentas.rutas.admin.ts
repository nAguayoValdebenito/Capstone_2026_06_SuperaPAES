// Rutas de /api/v1/admin/cuentas: ingreso, renovación y cierre de la sesión del personal interno
// (públicas, con límite de intentos: el token de acceso puede haber vencido y la credencial de
// renovación basta). Las rutas de sesión que se agreguen aquí y necesiten el token de acceso llevan
// mw.autenticarAdmin en su cadena, porque este router se monta antes de la autenticación general de /admin.
import { Router } from 'express';
import type { MiddlewareRutas } from '../../comun/middleware/index.js';
import { validar } from '../../comun/middleware/validacion.js';
import { crearCuentasControlador } from './cuentas.controlador.js';
import type { CuentasServicio } from './cuentas.servicio.js';
import { esquemaIngreso, esquemaSesionConsola } from './cuentas.validadores.js';

export function crearRutasAdminCuentas(servicio: CuentasServicio, mw: MiddlewareRutas): Router {
  const router = Router();
  const controlador = crearCuentasControlador(servicio);

  router.post(
    '/ingreso',
    validar({ cuerpo: esquemaIngreso }),
    mw.crearLimiteIntentos({ soloFallidos: true }),
    controlador.ingresarConsola,
  );
  router.post(
    '/renovar',
    validar({ cuerpo: esquemaSesionConsola }),
    mw.crearLimiteIntentos({ soloFallidos: true }),
    controlador.renovarConsola,
  );
  router.post(
    '/cierre',
    validar({ cuerpo: esquemaSesionConsola }),
    mw.crearLimiteIntentos(),
    controlador.cerrarSesionConsola,
  );
  return router;
}
