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
  esquemaArchivosImportacion,
  esquemaConsultaTextos,
  esquemaFiltrosBanco,
  esquemaIdPregunta,
  esquemaIdTexto,
  esquemaImportacion,
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

  // Importar preguntas con la plantilla CSV (C04, HU-13.1, RF-G05, CU-16): revisar entrega el informe
  // sin guardar nada; importar exige la declaración del origen (RN-29) y crea las válidas.
  router.post(
    '/importaciones/revision',
    exigirRol('admin'),
    validar({ cuerpo: esquemaArchivosImportacion }),
    controlador.revisarImportacion,
  );
  router.post(
    '/importaciones',
    exigirRol('admin'),
    validar({ cuerpo: esquemaImportacion }),
    controlador.importarPreguntas,
  );

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
  // Publicar, retirar y volver a borrador (C02, HU-24, CU-21, RF-G09, RF-G10): solo una aprobada con
  // dificultad se publica, solo una publicada se retira y solo una retirada vuelve a borrador.
  const etapa = validar({ parametros: esquemaIdPregunta });
  router.post('/:id/publicar', exigirRol('admin'), etapa, controlador.publicarPregunta);
  router.post('/:id/retirar', exigirRol('admin'), etapa, controlador.retirarPregunta);
  router.post('/:id/borrador', exigirRol('admin'), etapa, controlador.volverABorrador);
  return router;
}
