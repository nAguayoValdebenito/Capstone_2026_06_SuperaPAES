// Rutas de /api/v1/admin/administracion (consola, JWT de la consola, rol admin): gestión de
// usuarios internos y especialidades, parámetros del sistema (contenido.configuracion), documentos
// legales, auditoría, panel de métricas y consulta de estudiantes.
// Cada ruta declara su rol (DAS 4.3.3); el módulo no aplica un rol común.
// Cada endpoint: router.<metodo>(ruta, exigirRol(...), validar(...), controlador.<accion>), con
// crearAdministracionControlador(servicio).
import { Router } from 'express';
import { exigirRol } from '../../comun/middleware/autorizacion.js';
import { validar } from '../../comun/middleware/validacion.js';
import { crearAdministracionControlador } from './administracion.controlador.js';
import type { AdministracionServicio } from './administracion.servicio.js';
import {
  esquemaCrearUsuarioInterno,
  esquemaEditarUsuarioInterno,
  esquemaIdUsuarioInterno,
} from './administracion.validadores.js';

export function crearRutasAdminAdministracion(servicio: AdministracionServicio): Router {
  const router = Router();
  const controlador = crearAdministracionControlador(servicio);
  const soloAdmin = exigirRol('admin');

  // Usuarios internos (C10, HU-04, CU-23).
  const conId = validar({ parametros: esquemaIdUsuarioInterno });
  router.get('/usuarios-internos', soloAdmin, controlador.listarUsuariosInternos);
  router.post(
    '/usuarios-internos',
    soloAdmin,
    validar({ cuerpo: esquemaCrearUsuarioInterno }),
    controlador.crearUsuarioInterno,
  );
  router.patch(
    '/usuarios-internos/:id',
    soloAdmin,
    validar({ parametros: esquemaIdUsuarioInterno, cuerpo: esquemaEditarUsuarioInterno }),
    controlador.editarUsuarioInterno,
  );
  router.post(
    '/usuarios-internos/:id/activar',
    soloAdmin,
    conId,
    controlador.activarUsuarioInterno,
  );
  router.post(
    '/usuarios-internos/:id/desactivar',
    soloAdmin,
    conId,
    controlador.desactivarUsuarioInterno,
  );
  return router;
}
