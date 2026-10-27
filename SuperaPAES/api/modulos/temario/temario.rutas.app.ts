// Rutas de /api/v1/app/temario (estudiante autenticado con el JWT de la app): áreas, pruebas,
// habilidades, ejes y contenidos del temario PAES, y las pruebas que sugiere cada área de carrera.
// Cada endpoint: router.<metodo>(ruta, validar(...), controlador.<accion>), con crearTemarioControlador(servicio).
import { Router } from 'express';
import { crearTemarioControlador } from './temario.controlador.js';
import type { TemarioServicio } from './temario.servicio.js';

export function crearRutasAppTemario(servicio: TemarioServicio): Router {
  const router = Router();
  const controlador = crearTemarioControlador(servicio);

  // HU-29.1: cursos, pruebas con electivos y áreas de carrera de las pantallas del perfil (A08 a A10).
  router.get('/opciones-perfil', controlador.opcionesPerfil);
  return router;
}
