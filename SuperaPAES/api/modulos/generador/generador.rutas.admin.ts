// Rutas de /api/v1/admin/generador (consola, JWT de la consola, rol admin): lotes de generación de
// preguntas con IA (la cola la consume el worker de trabajos/).
// Cada ruta declara su rol (DAS 4.3.3); el módulo no aplica un rol común.
import { Router } from 'express';
import { exigirRol } from '../../comun/middleware/autorizacion.js';
import { validar } from '../../comun/middleware/validacion.js';
import { crearGeneradorControlador } from './generador.controlador.js';
import type { GeneradorServicio } from './generador.servicio.js';
import { esquemaConsultaLotes, esquemaIdLote, esquemaNuevoLote } from './generador.validadores.js';

export function crearRutasAdminGenerador(servicio: GeneradorServicio): Router {
  const router = Router();
  const controlador = crearGeneradorControlador(servicio);
  // HU-16.2 (CU-17 pasos 1 y 2): el pedido queda en la cola y responde de inmediato.
  router.post(
    '/lotes',
    exigirRol('admin'),
    validar({ cuerpo: esquemaNuevoLote }),
    controlador.crearLote,
  );
  // RNF-03: lo usado de los topes diario y mensual, para mostrarlos antes de pedir.
  router.get('/uso', exigirRol('admin'), controlador.usoDeLaIa);
  // HU-16.3: la consola consulta el avance del lote (polling).
  router.get(
    '/lotes',
    exigirRol('admin'),
    validar({ consulta: esquemaConsultaLotes }),
    controlador.listarLotes,
  );
  router.get(
    '/lotes/:id',
    exigirRol('admin'),
    validar({ parametros: esquemaIdLote }),
    controlador.obtenerLote,
  );
  return router;
}
