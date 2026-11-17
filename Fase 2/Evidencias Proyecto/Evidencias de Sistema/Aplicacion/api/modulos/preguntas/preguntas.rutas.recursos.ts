// Rutas públicas de /api/v1/recursos (sin sesión): las imágenes de las preguntas y de los textos de
// lectura. La app las pide con Image.network y la consola con <img>, que no envían el
// token. La dirección es la huella SHA-256 de la imagen: no se puede adivinar ni listar, y la imagen no
// tiene datos de ningún estudiante. RN-06 se cumple porque la dirección viaja dentro del texto de la
// pregunta, que la app recibe solo cuando corresponde.
import { Router } from 'express';
import { validar } from '../../comun/middleware/validacion.js';
import { crearPreguntasControlador } from './preguntas.controlador.js';
import type { PreguntasServicio } from './preguntas.servicio.js';
import { esquemaArchivoImagen } from './preguntas.validadores.js';

export function crearRutasRecursosPreguntas(servicio: PreguntasServicio): Router {
  const router = Router();
  const controlador = crearPreguntasControlador(servicio);
  router.get(
    '/imagenes/:archivo',
    validar({ parametros: esquemaArchivoImagen }),
    controlador.obtenerImagen,
  );
  return router;
}
