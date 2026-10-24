// Rutas de /api/v1/app/cuentas: registro, sesión del estudiante (ingreso, renovar y cerrar) y
// recuperación de contraseña. Son públicas: renovar y cerrar reciben el token de renovación en el
// cuerpo, así cerrar sirve aunque el token de acceso haya vencido (HU-02 escenarios 2 y 3).
// Las rutas de la cuenta del estudiante que se agreguen aquí llevan mw.autenticarApp en su cadena,
// porque este router se monta antes de la autenticación general de /app.
import { Router } from 'express';
import type { MiddlewareRutas } from '../../comun/middleware/index.js';
import { validar } from '../../comun/middleware/validacion.js';
import { crearCuentasControlador } from './cuentas.controlador.js';
import type { CuentasServicio } from './cuentas.servicio.js';
import {
  esquemaIngresoApp,
  esquemaRecuperacion,
  esquemaRegistro,
  esquemaTokenRenovacion,
} from './cuentas.validadores.js';

export function crearRutasAppCuentas(servicio: CuentasServicio, mw: MiddlewareRutas): Router {
  const router = Router();
  const controlador = crearCuentasControlador(servicio);
  const conToken = validar({ cuerpo: esquemaTokenRenovacion });

  // Públicas: validar → limitar intentos.
  router.post(
    '/registro',
    validar({ cuerpo: esquemaRegistro }),
    mw.crearLimiteIntentos(),
    controlador.registrar,
  );
  // Límite de intentos por IP y por correo (RNF-02); solo cuentan los ingresos fallidos.
  router.post(
    '/ingreso',
    validar({ cuerpo: esquemaIngresoApp }),
    mw.crearLimiteIntentos({ soloFallidos: true }),
    mw.crearLimiteIntentos({ soloFallidos: true, porCorreo: true }),
    controlador.ingresar,
  );
  router.post('/renovar', conToken, controlador.renovarApp);
  router.post('/cerrar', conToken, controlador.cerrarApp);
  router.post(
    '/recuperar-contrasena',
    validar({ cuerpo: esquemaRecuperacion }),
    mw.crearLimiteIntentos(),
    controlador.solicitarRecuperacion,
  );
  return router;
}
