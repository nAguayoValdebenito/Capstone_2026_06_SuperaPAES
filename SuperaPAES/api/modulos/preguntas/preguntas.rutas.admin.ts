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
import { esquemaFiltrosBanco } from './preguntas.validadores.js';

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
  return router;
}
