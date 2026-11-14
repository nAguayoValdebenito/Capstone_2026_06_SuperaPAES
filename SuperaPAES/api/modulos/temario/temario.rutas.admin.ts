// Rutas de /api/v1/admin/temario (consola, JWT de la consola, rol admin): áreas, pruebas,
// habilidades, ejes y contenidos del temario PAES, y las listas de opciones de C09 (dificultades y
// áreas de carrera con las pruebas que sugiere cada una), y la edición de la mezcla global de
// dificultad (RF-C12, RN-09; decisión del 14/11/2026).
// Cada ruta declara su rol (DAS 4.3.3); el módulo no aplica un rol común.
// Cada endpoint: router.<metodo>(ruta, exigirRol(...), validar(...), controlador.<accion>), con
// crearTemarioControlador(servicio).
import { Router } from 'express';
import { exigirRol } from '../../comun/middleware/autorizacion.js';
import { validar } from '../../comun/middleware/validacion.js';
import { crearTemarioControlador } from './temario.controlador.js';
import type { TemarioServicio } from './temario.servicio.js';
import { esquemaMezclaDificultad } from './temario.validadores.js';

export function crearRutasAdminTemario(servicio: TemarioServicio): Router {
  const router = Router();
  const controlador = crearTemarioControlador(servicio);

  router.get('/', exigirRol('admin'), controlador.consultarTemario);
  router.get('/areas', exigirRol('admin'), controlador.listarAreas);
  router.get('/listas-opciones', exigirRol('admin'), controlador.consultarListasOpciones);
  router.put(
    '/listas-opciones/dificultades',
    exigirRol('admin'),
    validar({ cuerpo: esquemaMezclaDificultad }),
    controlador.editarMezclaDificultad,
  );
  return router;
}
