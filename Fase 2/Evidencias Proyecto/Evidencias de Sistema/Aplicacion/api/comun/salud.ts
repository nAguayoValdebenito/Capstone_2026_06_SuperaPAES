// Salud del monolito. No es un módulo de negocio: es infraestructura común.
// GET /api/v1/salud: la API y la base de datos (con tiempo límite; 503 si la base no responde).
// GET /api/v1/salud/vivo: solo el proceso, sin tocar la base (chequeo periódico de Render).
import { Router } from 'express';
import { ErrorBaseDeDatosNoDisponible } from './errores.js';
import { responder } from './respuesta.js';

export interface EstadoSalud {
  estado: 'ok';
  baseDeDatos: 'ok';
}

export function crearRutasSalud(comprobarBaseDeDatos: () => Promise<void>): Router {
  const router = Router();
  router.get('/', async (_req, res) => {
    try {
      await comprobarBaseDeDatos();
    } catch (error) {
      throw new ErrorBaseDeDatosNoDisponible(error);
    }
    responder<EstadoSalud>(res, { estado: 'ok', baseDeDatos: 'ok' });
  });
  router.get('/vivo', (_req, res) => {
    responder(res, { estado: 'ok' });
  });
  return router;
}
