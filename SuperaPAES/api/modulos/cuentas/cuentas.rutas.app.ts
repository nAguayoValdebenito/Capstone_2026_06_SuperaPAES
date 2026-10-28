// Rutas de /api/v1/app/cuentas: registro, sesión del estudiante (ingreso, renovar y cerrar),
// verificación del correo (HU-05, RN-32), recuperación de contraseña y perfil (HU-29). Las de la
// sesión, la verificación por enlace y la recuperación son públicas: renovar y cerrar reciben el
// token de renovación en el cuerpo, así cerrar sirve aunque el token de acceso haya vencido (HU-02
// escenarios 2 y 3).
// Las rutas de la cuenta del estudiante que se agreguen aquí llevan mw.autenticarApp en su cadena,
// porque este router se monta antes de la autenticación general de /app.
import { Router } from 'express';
import type { MiddlewareRutas } from '../../comun/middleware/index.js';
import { validar } from '../../comun/middleware/validacion.js';
import { crearCuentasControlador, type CuentasControlador } from './cuentas.controlador.js';
import { montarPuntajes } from './cuentas.puntajes.rutas.js';
import type { CuentasServicio } from './cuentas.servicio.js';
import {
  esquemaCodigoVerificacion,
  esquemaConfirmarCurso,
  esquemaEnlaceVerificacion,
  esquemaIngresoApp,
  esquemaPerfil,
  esquemaRecuperacion,
  esquemaRegistro,
  esquemaRestablecer,
  esquemaTokenRenovacion,
} from './cuentas.validadores.js';

/** Documentos legales vigentes: pública y sin sesión, así que lleva un límite por IP (60 por minuto). */
const LIMITE_DOCUMENTOS_VIGENTES = { ventanaMs: 60 * 1000, maximo: 60 };

/**
 * Pedir la recuperación de la contraseña: 5 por hora por IP y 3 por hora por correo, contando todas las
 * peticiones (exista o no la cuenta), para que no sirva para llenar de correos a un tercero.
 */
const LIMITE_RECUPERACION_POR_IP = { ventanaMs: 60 * 60 * 1000, maximo: 5 };
const LIMITE_RECUPERACION_POR_CORREO = { ventanaMs: 60 * 60 * 1000, maximo: 3 };

/** Reenviar el correo de verificación: 3 por hora por estudiante, para que no sirva para enviar en masa. */
const LIMITE_REENVIO_VERIFICACION = { ventanaMs: 60 * 60 * 1000, maximo: 3 };

/** Recuperación de la contraseña (HU-06). */
function montarRecuperacion(
  router: Router,
  controlador: CuentasControlador,
  mw: MiddlewareRutas,
): void {
  // Las dos son públicas: las llama la consola desde el
  // navegador, con el enlace del correo.
  router.post(
    '/recuperacion/solicitar',
    validar({ cuerpo: esquemaRecuperacion }),
    mw.crearLimiteIntentos(LIMITE_RECUPERACION_POR_IP),
    mw.crearLimiteIntentos({ ...LIMITE_RECUPERACION_POR_CORREO, porCorreo: true }),
    controlador.solicitarRecuperacion,
  );
  router.post(
    '/recuperacion/restablecer',
    validar({ cuerpo: esquemaRestablecer }),
    mw.crearLimiteIntentos({ soloFallidos: true }),
    controlador.restablecerContrasena,
  );
}

/** Perfil del estudiante (HU-29.1): con sesión, sin otro límite. */
function montarPerfil(router: Router, controlador: CuentasControlador, mw: MiddlewareRutas): void {
  router.get('/perfil', mw.autenticarApp, controlador.obtenerPerfil);
  router.put(
    '/perfil',
    mw.autenticarApp,
    validar({ cuerpo: esquemaPerfil }),
    controlador.guardarPerfil,
  );
  router.post(
    '/perfil/confirmar-curso',
    mw.autenticarApp,
    validar({ cuerpo: esquemaConfirmarCurso }),
    controlador.confirmarCurso,
  );
}

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
  router.get(
    '/documentos-legales/vigentes',
    mw.crearLimiteIntentos(LIMITE_DOCUMENTOS_VIGENTES),
    controlador.documentosVigentes,
  );
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
  montarRecuperacion(router, controlador, mw);
  montarPerfil(router, controlador, mw);
  montarPuntajes(router, servicio, mw);
  return router;
}
