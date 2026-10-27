// Rutas de /api/v1/admin/preguntas (consola, JWT de la consola, rol admin): banco de preguntas,
// alternativas, versiones, textos de estímulo, importaciones y avisos de error de los estudiantes.
// Cada ruta declara su rol (DAS 4.3.3); el módulo no aplica un rol común.
// Cada endpoint: router.<metodo>(ruta, exigirRol(...), validar(...), controlador.<accion>), con
// crearPreguntasControlador(servicio).
import { Router } from 'express';
import { exigirRol } from '../../comun/middleware/autorizacion.js';
import { validar } from '../../comun/middleware/validacion.js';
import { crearPreguntasControlador } from './preguntas.controlador.js';
import type { PreguntasServicio } from './preguntas.servicio.js';
import {
  esquemaFiltrosBanco,
  esquemaIdPregunta,
  esquemaPregunta,
} from './preguntas.validadores.js';

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
