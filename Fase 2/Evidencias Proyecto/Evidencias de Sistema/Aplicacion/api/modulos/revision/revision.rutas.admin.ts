// Rutas de /api/v1/admin/revision (consola, JWT de la consola): asignaciones a docentes, revisiones
// con la pauta, desempate y clasificación de dificultad.
// Cada ruta declara su rol (DAS 4.3.3): las del docente revisor (Mis revisiones, Desempates y
// Clasificar dificultad) solo
// aceptan al docente y las de seguimiento (Revisiones, C06) solo al administrador. El módulo no
// aplica un rol común. Clasificar dificultad (D03, HU-25) y Calibración (D04, HU-26) son del docente;
// las confirmadas de la calibración, del administrador.
// Cada endpoint: router.<metodo>(ruta, exigirRol(...), validar(...), controlador.<accion>), con
// crearRevisionControlador(servicio).
import { Router } from 'express';
import { exigirRol } from '../../comun/middleware/autorizacion.js';
import { validar } from '../../comun/middleware/validacion.js';
import { crearRevisionControlador, type RevisionControlador } from './revision.controlador.js';
import type { RevisionServicio } from './revision.servicio.js';
import {
  esquemaCalibracion,
  esquemaClasificacion,
  esquemaConsultaClasificacion,
  esquemaConsultaSeguimiento,
  esquemaDesempate,
  esquemaIdPregunta,
  esquemaIdRevision,
  esquemaRevision,
} from './revision.validadores.js';

/**
 * Docente revisor: Clasificar dificultad (D03, HU-25, CU-19a): la siguiente importada que tiene asignada
 * y su clasificación con un clic, que entrega su revisión de la ronda.
 */
function agregarRutasClasificacion(router: Router, controlador: RevisionControlador): void {
  router.get(
    '/clasificar/siguiente',
    exigirRol('docente'),
    validar({ consulta: esquemaConsultaClasificacion }),
    controlador.siguienteAClasificar,
  );
  router.post(
    '/clasificar/:id',
    exigirRol('docente'),
    validar({ parametros: esquemaIdRevision, cuerpo: esquemaClasificacion }),
    controlador.clasificarDificultad,
  );
}

/**
 * Calibración (D04, HU-26.1, RN-15): el docente ve las preguntas de su área fuera de su rango de acierto
 * y decide sobre cada una; el administrador ve las confirmadas (C02, HU-26.2) para retirarlas y enviarlas
 * a una nueva revisión con las rutas que ya existen.
 */
function agregarRutasCalibracion(router: Router, controlador: RevisionControlador): void {
  router.get('/calibracion', exigirRol('docente'), controlador.listarCalibracion);
  router.get('/calibracion/confirmadas', exigirRol('admin'), controlador.listarConfirmadas);
  router.post(
    '/calibracion/:id',
    exigirRol('docente'),
    validar({ parametros: esquemaIdPregunta, cuerpo: esquemaCalibracion }),
    controlador.decidirCalibracion,
  );
}

export function crearRutasAdminRevision(servicio: RevisionServicio): Router {
  const router = Router();
  const controlador = crearRevisionControlador(servicio);

  // Docente revisor: Mis revisiones (D01, HU-22): su bandeja, la pregunta a ciegas y su revisión.
  router.get('/mis-revisiones', exigirRol('docente'), controlador.listarMisRevisiones);
  router.get(
    '/mis-revisiones/:id',
    exigirRol('docente'),
    validar({ parametros: esquemaIdRevision }),
    controlador.obtenerMiRevision,
  );
  router.post(
    '/mis-revisiones/:id',
    exigirRol('docente'),
    validar({ parametros: esquemaIdRevision, cuerpo: esquemaRevision }),
    controlador.entregarRevision,
  );
  // Docente revisor: Desempates (D02, HU-23, CU-20): sus desempates, la pregunta con las dos revisiones
  // y su decisión.
  router.get('/desempates', exigirRol('docente'), controlador.listarDesempates);
  router.get(
    '/desempates/:id',
    exigirRol('docente'),
    validar({ parametros: esquemaIdRevision }),
    controlador.obtenerDesempate,
  );
  router.post(
    '/desempates/:id',
    exigirRol('docente'),
    validar({ parametros: esquemaIdRevision, cuerpo: esquemaDesempate }),
    controlador.entregarDesempate,
  );
  agregarRutasCalibracion(router, controlador);
  agregarRutasClasificacion(router, controlador);
  // Administrador: seguimiento de las revisiones (C06).
  router.get(
    '/seguimiento',
    exigirRol('admin'),
    validar({ consulta: esquemaConsultaSeguimiento }),
    controlador.listarSeguimiento,
  );
  // Administrador: enviar una pregunta a revisión, que le asigna sus revisores (C02, HU-21, CU-18).
  router.post(
    '/preguntas/:id',
    exigirRol('admin'),
    validar({ parametros: esquemaIdPregunta }),
    controlador.enviarARevision,
  );
  return router;
}
