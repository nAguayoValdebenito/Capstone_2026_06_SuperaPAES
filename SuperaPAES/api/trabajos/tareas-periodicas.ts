// Tareas periódicas (DAS 4.3.3 y 4.3.5). No es un módulo de negocio: vive en trabajos, junto al worker.
// POST /api/v1/tareas/periodicas: la llama cada hora el flujo programado de GitHub Actions
// (.github/workflows/tareas-periodicas.yml) con `Authorization: Bearer <CLAVE_TAREAS>`, una clave que
// solo conocen GitHub y el servidor. Cierra y corrige las evaluaciones con el tiempo cumplido y cierra
// las prácticas sin actividad (app.cerrar_vencidas). Los avisos de renovación (HU-44) se suman aquí.
import { createHash, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { ErrorNoAutenticado } from '../comun/errores.js';
import { registro } from '../comun/registro.js';
import { responder } from '../comun/respuesta.js';

export interface TareasPeriodicas {
  /** Cuántas evaluaciones cerró. */
  cerrarVencidas(): Promise<number>;
}

export interface ResultadoTareas {
  evaluacionesCerradas: number;
}

// Se comparan los resúmenes, del mismo largo, en tiempo constante: la respuesta no revela la clave.
const resumen = (texto: string) => createHash('sha256').update(texto).digest();

export function crearRutasTareas(clave: string, tareas: TareasPeriodicas): Router {
  const esperada = resumen(`Bearer ${clave}`);
  const router = Router();
  router.post('/periodicas', async (req, res) => {
    if (!timingSafeEqual(resumen(req.get('authorization') ?? ''), esperada)) {
      throw new ErrorNoAutenticado('Clave de tareas inválida.');
    }
    const evaluacionesCerradas = await tareas.cerrarVencidas();
    registro.info('Tareas periódicas', { evaluacionesCerradas });
    responder<ResultadoTareas>(res, { evaluacionesCerradas });
  });
  return router;
}
