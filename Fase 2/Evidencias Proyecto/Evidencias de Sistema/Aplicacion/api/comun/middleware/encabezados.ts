// Encabezados de seguridad de las respuestas de la API.
import type { RequestHandler } from 'express';
import helmet from 'helmet';

/**
 * helmet: nosniff, HSTS, sin enmarcar, sin X-Powered-By (no dice con qué está hecha la API) y una
 * política de contenido mínima para lo que se abra en un navegador.
 */
export const encabezadosSeguridad: RequestHandler = helmet();

/**
 * Respuestas que ni el navegador ni un proxy intermedio deben guardar: las de la consola llevan datos
 * personales y del banco de preguntas. Una ruta puede cambiarlo con su propio Cache-Control.
 */
export const sinAlmacenar: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};
