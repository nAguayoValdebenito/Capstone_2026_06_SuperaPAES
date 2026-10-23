// Rutas de /api/v1/admin/revision (consola, JWT de la consola): asignaciones a docentes, revisiones
// con la pauta, desempate y clasificación de dificultad.
// Cada ruta declara su rol (DAS 4.3.3): las del docente revisor (Mis revisiones y Desempates) solo
// aceptan al docente y las de seguimiento (Revisiones, C06) solo al administrador. El módulo no
// aplica un rol común. Calibración y Clasificar dificultad se agregan con HU-25 y HU-26.
// Cada endpoint: router.<metodo>(ruta, exigirRol(...), validar(...), controlador.<accion>), con
// crearRevisionControlador(servicio).
import { Router } from 'express';
import { exigirRol } from '../../comun/middleware/autorizacion.js';
import { crearRevisionControlador } from './revision.controlador.js';
import type { RevisionServicio } from './revision.servicio.js';

export function crearRutasAdminRevision(servicio: RevisionServicio): Router {
  const router = Router();
  const controlador = crearRevisionControlador(servicio);

  // Docente revisor: Mis revisiones (D01) y Desempates (D02).
  router.get('/mis-revisiones', exigirRol('docente'), controlador.listarMisRevisiones);
  router.get('/desempates', exigirRol('docente'), controlador.listarDesempates);
  // Administrador: seguimiento de las revisiones (C06).
  router.get('/seguimiento', exigirRol('admin'), controlador.listarSeguimiento);
  return router;
}
