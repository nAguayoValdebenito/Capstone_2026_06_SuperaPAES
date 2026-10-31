// Rutas de /api/v1/admin/preguntas (consola, JWT de la consola, rol admin): banco de preguntas,
// alternativas, versiones, textos de estímulo, importaciones y avisos de error de los estudiantes.
// Cada ruta declara su rol (DAS 4.3.3); el módulo no aplica un rol común.
// Cada endpoint: router.<metodo>(ruta, exigirRol(...), validar(...), controlador.<accion>), con
// crearPreguntasControlador(servicio).
import { Router } from 'express';
import { exigirRol } from '../../comun/middleware/autorizacion.js';
import { validar } from '../../comun/middleware/validacion.js';
import { crearPreguntasControlador, type PreguntasControlador } from './preguntas.controlador.js';
import type { PreguntasServicio } from './preguntas.servicio.js';
import {
  esquemaConsultaTextos,
  esquemaFiltrosBanco,
  esquemaIdPregunta,
  esquemaIdTexto,
  esquemaPregunta,
  esquemaTexto,
} from './preguntas.validadores.js';

/** Textos de lectura (C03, HU-12.2). Van antes de /:id, para que «textos» no se lea como una pregunta. */
function agregarRutasTextos(router: Router, controlador: PreguntasControlador): void {
  router.get(
    '/textos',
    exigirRol('admin'),
    validar({ consulta: esquemaConsultaTextos }),
    controlador.listarTextos,
  );
  router.get('/textos/tipos', exigirRol('admin'), controlador.tiposDeTexto);
  router.get(
    '/textos/:id',
    exigirRol('admin'),
    validar({ parametros: esquemaIdTexto }),
    controlador.obtenerTexto,
  );
  router.post(
    '/textos',
    exigirRol('admin'),
    validar({ cuerpo: esquemaTexto }),
    controlador.crearTexto,
  );
  router.put(
    '/textos/:id',
    exigirRol('admin'),
    validar({ parametros: esquemaIdTexto, cuerpo: esquemaTexto }),
    controlador.editarTexto,
  );
}

export function crearRutasAdminPreguntas(servicio: PreguntasServicio): Router {
  const router = Router();
  const controlador = crearPreguntasControlador(servicio);

  // Banco de preguntas (C02, HU-11, RF-G01): lista filtrada y paginada, y las opciones de sus filtros.
  router.get(
    '/',
    exigirRol('admin'),
    validar({ consulta: esquemaFiltrosBanco }),
    controlador.listarBanco,
  );
  router.get('/filtros', exigirRol('admin'), controlador.filtrosDelBanco);

  agregarRutasTextos(router, controlador);

  // Crear y editar preguntas (C03, HU-12.1, RF-G02, RF-G09): la consola del administrador recibe la
  // pregunta completa, con la alternativa correcta.
  router.post(
    '/',
    exigirRol('admin'),
    validar({ cuerpo: esquemaPregunta }),
    controlador.crearPregunta,
  );
  router.get(
    '/:id',
    exigirRol('admin'),
    validar({ parametros: esquemaIdPregunta }),
    controlador.obtenerPregunta,
  );
  router.put(
    '/:id',
    exigirRol('admin'),
    validar({ parametros: esquemaIdPregunta, cuerpo: esquemaPregunta }),
    controlador.editarPregunta,
  );
  return router;
}
