// Rutas de /api/v1/app/cuentas: registro, ingreso y recuperación de contraseña (públicas, con límite
// de intentos). Las rutas de la cuenta del estudiante que se agreguen aquí llevan mw.autenticarApp
// en su cadena, porque este router se monta antes de la autenticación general de /app.
import { Router } from 'express';
import type { MiddlewareRutas } from '../../comun/middleware/index.js';
import { validar } from '../../comun/middleware/validacion.js';
import { crearCuentasControlador } from './cuentas.controlador.js';
import type { CuentasServicio } from './cuentas.servicio.js';
import { esquemaIngreso, esquemaRecuperacion, esquemaRegistro } from './cuentas.validadores.js';

export function crearRutasAppCuentas(servicio: CuentasServicio, mw: MiddlewareRutas): Router {
  const router = Router();
  const controlador = crearCuentasControlador(servicio);

  // Públicas: validar → limitar intentos.
  router.post(
    '/registro',
    validar({ cuerpo: esquemaRegistro }),
    mw.crearLimiteIntentos(),
    controlador.registrar,
  );
  router.post(
    '/ingreso',
    validar({ cuerpo: esquemaIngreso }),
    mw.crearLimiteIntentos({ soloFallidos: true }),
    controlador.ingresar,
  );
  router.post(
    '/recuperar-contrasena',
    validar({ cuerpo: esquemaRecuperacion }),
    mw.crearLimiteIntentos(),
    controlador.solicitarRecuperacion,
  );
  return router;
}
