// Rutas de /api/v1/admin/suscripciones (consola, JWT de la consola, rol admin): planes,
// suscripciones compradas en Google Play o la App Store, pagos, historial de estados y avisos de
// las tiendas.
// Cada ruta declara su rol (DAS 4.3.3); el módulo no aplica un rol común.
// Cada endpoint: router.<metodo>(ruta, exigirRol(...), validar(...), controlador.<accion>), con
// crearSuscripcionesControlador(servicio).
import { Router } from 'express';
import { exigirRol } from '../../comun/middleware/autorizacion.js';
import { validar } from '../../comun/middleware/validacion.js';
import { crearTrazabilidadControlador } from './suscripciones.trazabilidad.controlador.js';
import {
  esquemaConsultaAvisos,
  esquemaFiltrosSuscripciones,
} from './suscripciones.trazabilidad.validadores.js';
import type { SuscripcionesServicio } from './suscripciones.servicio.js';
import { esquemaIdSuscripcion } from './suscripciones.validadores.js';

export function crearRutasAdminSuscripciones(servicio: SuscripcionesServicio): Router {
  const router = Router();
  // Trazabilidad (C16, HU-56). /resumen y /avisos-error van antes de /:id.
  const trazabilidad = crearTrazabilidadControlador(servicio);
  router.get('/resumen', exigirRol('admin'), trazabilidad.resumen);
  router.get(
    '/avisos-error',
    exigirRol('admin'),
    validar({ consulta: esquemaConsultaAvisos }),
    trazabilidad.avisosConError,
  );
  router.get(
    '/',
    exigirRol('admin'),
    validar({ consulta: esquemaFiltrosSuscripciones }),
    trazabilidad.listar,
  );
  router.get(
    '/:id',
    exigirRol('admin'),
    validar({ parametros: esquemaIdSuscripcion }),
    trazabilidad.detalle,
  );
  return router;
}
