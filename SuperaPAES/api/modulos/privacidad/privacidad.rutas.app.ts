// Rutas de /api/v1/app/privacidad (estudiante autenticado con el JWT de la app): solicitudes de
// derechos sobre datos personales (Ley 21.719), exportación y borrado de la cuenta con
// seudonimización. La autenticación la aplica app.ts antes de montar este router.
// Cada endpoint: router.<metodo>(ruta, validar(...), limite, controlador.<accion>), con
// crearPrivacidadControlador(servicio).
import { Router } from 'express';
import type { MiddlewareRutas } from '../../comun/middleware/index.js';
import { validar } from '../../comun/middleware/validacion.js';
import { crearPrivacidadControlador } from './privacidad.controlador.js';
import type { PrivacidadServicio } from './privacidad.servicio.js';
import { esquemaConfirmacionContrasena, esquemaNuevaSolicitud } from './privacidad.validadores.js';

/** Contraseñas incorrectas permitidas por estudiante antes de bloquear descargar y borrar. */
const MAXIMO_CONTRASENAS_FALLIDAS = 5;
const VENTANA_CONTRASENA_MS = 15 * 60 * 1000;
/** Solicitudes de derechos por estudiante en un día (cuentan todas, también las aceptadas). */
const MAXIMO_SOLICITUDES_DIA = 5;
const VENTANA_SOLICITUDES_MS = 24 * 60 * 60 * 1000;

export function crearRutasAppPrivacidad(
  servicio: PrivacidadServicio,
  mw: Pick<MiddlewareRutas, 'crearLimiteIntentos'>,
): Router {
  const router = Router();
  const controlador = crearPrivacidadControlador(servicio);
  // Un solo contador para las dos rutas que piden la contraseña: probarla en una gasta los intentos
  // de la otra. Solo cuentan las respuestas fallidas.
  const limiteContrasena = mw.crearLimiteIntentos({
    porEstudiante: true,
    soloFallidos: true,
    ventanaMs: VENTANA_CONTRASENA_MS,
    maximo: MAXIMO_CONTRASENAS_FALLIDAS,
  });
  const conContrasena = validar({ cuerpo: esquemaConfirmacionContrasena });
  // HU-07.1: «Descargar mis datos» (A39). POST porque lleva la contraseña en el cuerpo.
  router.post('/mis-datos', conContrasena, limiteContrasena, controlador.exportarDatos);
  // Los términos aceptados de Mis datos (A39) y la suscripción vigente que avisa A42b (RN-34).
  router.get('/cuenta', controlador.estadoDeLaCuenta);
  // HU-08.1: «Borrar mi cuenta» (A42 y A42b).
  router.delete('/cuenta', conContrasena, limiteContrasena, controlador.borrarCuenta);
  // HU-09.1 (RF-A21, A40): los derechos que se pueden pedir, enviar una solicitud y ver las propias.
  router.get('/tipos-derecho', controlador.tiposDerecho);
  router.post(
    '/solicitudes',
    validar({ cuerpo: esquemaNuevaSolicitud }),
    mw.crearLimiteIntentos({
      porEstudiante: true,
      ventanaMs: VENTANA_SOLICITUDES_MS,
      maximo: MAXIMO_SOLICITUDES_DIA,
    }),
    controlador.crearSolicitud,
  );
  router.get('/solicitudes', controlador.misSolicitudes);
  return router;
}
