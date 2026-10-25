// Rutas de /api/v1/app/cuentas: registro, sesión del estudiante (ingreso, renovar y cerrar),
// verificación del correo (HU-05, RN-32) y recuperación de contraseña. Son públicas: renovar y cerrar reciben el token de renovación en el
// cuerpo, así cerrar sirve aunque el token de acceso haya vencido (HU-02 escenarios 2 y 3).
// Las rutas de la cuenta del estudiante que se agreguen aquí llevan mw.autenticarApp en su cadena,
// porque este router se monta antes de la autenticación general de /app.
import { Router } from 'express';
import type { MiddlewareRutas } from '../../comun/middleware/index.js';
import { validar } from '../../comun/middleware/validacion.js';
import { crearCuentasControlador } from './cuentas.controlador.js';
import type { CuentasServicio } from './cuentas.servicio.js';
import {
  esquemaCodigoVerificacion,
  esquemaEnlaceVerificacion,
  esquemaIngresoApp,
  esquemaRecuperacion,
  esquemaRegistro,
  esquemaTokenRenovacion,
} from './cuentas.validadores.js';

/** Reenviar el correo de verificación: 3 por hora por estudiante, para que no sirva para enviar en masa. */
const LIMITE_REENVIO_VERIFICACION = { ventanaMs: 60 * 60 * 1000, maximo: 3 };

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
  // Pública: la usan el registro de la app y las páginas /terminos y /privacidad de la consola.
  router.get('/documentos-legales/vigentes', controlador.documentosVigentes);
  router.post('/renovar', conToken, controlador.renovarApp);
  router.post('/cerrar', conToken, controlador.cerrarApp);
  // Verificación del correo. El enlace es público (se abre desde la página de la consola, quizá en un
  // computador sin sesión) y su límite cuenta solo los intentos fallidos por IP.
  router.post(
    '/verificacion/enlace',
    validar({ cuerpo: esquemaEnlaceVerificacion }),
    mw.crearLimiteIntentos({ soloFallidos: true }),
    controlador.verificarEnlace,
  );
  // El código exige sesión: cada correo admite 5 intentos (RN-32), así que no lleva otro límite.
  router.post(
    '/verificacion/codigo',
    mw.autenticarApp,
    validar({ cuerpo: esquemaCodigoVerificacion }),
    controlador.verificarCodigo,
  );
  router.post(
    '/verificacion/reenviar',
    mw.autenticarApp,
    mw.crearLimiteIntentos({ porEstudiante: true, ...LIMITE_REENVIO_VERIFICACION }),
    controlador.reenviarVerificacion,
  );
  router.post(
    '/recuperar-contrasena',
    validar({ cuerpo: esquemaRecuperacion }),
    mw.crearLimiteIntentos(),
    controlador.solicitarRecuperacion,
  );
  return router;
}
