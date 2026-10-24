// Rutas de /api/v1/admin/cuentas: sesión del personal interno (HU-02.1, parte de la consola).
// Ingreso, renovar y cerrar son públicas (no piden el token de acceso): renovar y cerrar reciben el
// token de renovación, así cerrar sirve aunque el token de acceso ya haya vencido (CP-04 paso 4).
// Este router se monta antes de la autenticación general de /admin: una ruta con sesión lleva
// mw.autenticarAdmin y exigirRol en su propia cadena.
import { Router } from 'express';
import type { MiddlewareRutas } from '../../comun/middleware/index.js';
import { exigirRol, rutaPublica } from '../../comun/middleware/autorizacion.js';
import { validar } from '../../comun/middleware/validacion.js';
import { crearCuentasControlador } from './cuentas.controlador.js';
import type { CuentasServicio } from './cuentas.servicio.js';
import { esquemaIngreso, esquemaTokenRenovacion } from './cuentas.validadores.js';

export function crearRutasAdminCuentas(servicio: CuentasServicio, mw: MiddlewareRutas): Router {
  const router = Router();
  const controlador = crearCuentasControlador(servicio);
  const conToken = validar({ cuerpo: esquemaTokenRenovacion });

  // Límite de intentos por IP y por correo (RNF-02); solo cuentan los ingresos fallidos.
  router.post(
    '/ingreso',
    rutaPublica,
    validar({ cuerpo: esquemaIngreso }),
    mw.crearLimiteIntentos({ soloFallidos: true }),
    mw.crearLimiteIntentos({ soloFallidos: true, porCorreo: true }),
    controlador.ingresarConsola,
  );
  router.post('/renovar', rutaPublica, conToken, controlador.renovarConsola);
  router.post('/cerrar', rutaPublica, conToken, controlador.cerrarConsola);
  // Usuario de la sesión, para que la consola arme el menú de su rol (HU-03.2).
  router.get('/yo', mw.autenticarAdmin, exigirRol('admin', 'docente'), controlador.usuarioConsola);
  return router;
}
