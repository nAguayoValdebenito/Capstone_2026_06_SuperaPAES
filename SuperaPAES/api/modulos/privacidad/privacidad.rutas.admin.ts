// Rutas de /api/v1/admin/privacidad (consola, JWT de la consola, rol admin): solicitudes de
// derechos sobre datos personales (Ley 21.719), exportación y borrado de la cuenta con
// seudonimización.
// Cada ruta declara su rol (DAS 4.3.3); el módulo no aplica un rol común.
// Cada endpoint: router.<metodo>(ruta, exigirRol(...), validar(...), controlador.<accion>), con
// crearPrivacidadControlador(servicio).
import { Router } from 'express';
import { exigirRol } from '../../comun/middleware/autorizacion.js';
import { validar } from '../../comun/middleware/validacion.js';
import { crearPrivacidadControlador } from './privacidad.controlador.js';
import type { PrivacidadServicio } from './privacidad.servicio.js';
import {
  esquemaAtencionSolicitud,
  esquemaFiltrosSolicitudes,
  esquemaIdSolicitud,
} from './privacidad.validadores.js';

export function crearRutasAdminPrivacidad(servicio: PrivacidadServicio): Router {
  const router = Router();
  const controlador = crearPrivacidadControlador(servicio);
  // HU-55.1 (RF-C10, C14): bandeja de solicitudes, una solicitud y su respuesta o rechazo.
  router.get(
    '/solicitudes',
    exigirRol('admin'),
    validar({ consulta: esquemaFiltrosSolicitudes }),
    controlador.listarSolicitudes,
  );
  router.get(
    '/solicitudes/:id',
    exigirRol('admin'),
    validar({ parametros: esquemaIdSolicitud }),
    controlador.obtenerSolicitud,
  );
  router.patch(
    '/solicitudes/:id',
    exigirRol('admin'),
    validar({ parametros: esquemaIdSolicitud, cuerpo: esquemaAtencionSolicitud }),
    controlador.atenderSolicitud,
  );
  return router;
}
