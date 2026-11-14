// Tareas periódicas (DAS 4.3.3 y 4.3.5). No es un módulo de negocio: vive en trabajos, junto al worker.
// POST /api/v1/tareas/periodicas: la llama cada hora el flujo programado de GitHub Actions
// (.github/workflows/tareas-periodicas.yml) con `Authorization: Bearer <CLAVE_TAREAS>`, una clave que
// solo conocen GitHub y el servidor. Cierra y corrige las evaluaciones con el tiempo cumplido y cierra
// las prácticas sin actividad (app.cerrar_vencidas), y deja canceladas las suscripciones que cancelaron
// la renovación y terminaron su período si el aviso de la tienda no llegó (HU-45.1). También envía el aviso
// por correo de las renovaciones anuales de los próximos 7 días (HU-45.3). Al final recalcula las
// estadísticas por pregunta (HU-53.1), para que cuenten las evaluaciones recién cerradas.
import { createHash, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { ErrorNoAutenticado } from '../comun/errores.js';
import { registro } from '../comun/registro.js';
import { responder } from '../comun/respuesta.js';

export interface TareasPeriodicas {
  /** Cuántas evaluaciones cerró. */
  cerrarVencidas(): Promise<number>;
  /** Cuántas suscripciones canceladas cerró al terminar su período (HU-45.1). */
  cerrarCanceladasVencidas(): Promise<number>;
  /** Cuántos avisos de renovación anual salieron y cuántos se reintentan en la hora siguiente (HU-45.3). */
  avisarRenovaciones(): Promise<{ enviados: number; fallidos: number }>;
  /** Cuántas filas de app.estadistica_pregunta cambiaron (HU-53.1). */
  recalcularEstadisticas(): Promise<number>;
}

export interface ResultadoTareas {
  evaluacionesCerradas: number;
  suscripcionesCanceladas: number;
  avisosRenovacion: number;
  avisosRenovacionFallidos: number;
  estadisticasActualizadas: number;
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
    const suscripcionesCanceladas = await tareas.cerrarCanceladasVencidas();
    const avisos = await tareas.avisarRenovaciones();
    const estadisticasActualizadas = await tareas.recalcularEstadisticas();
    const resultado: ResultadoTareas = {
      evaluacionesCerradas,
      suscripcionesCanceladas,
      avisosRenovacion: avisos.enviados,
      avisosRenovacionFallidos: avisos.fallidos,
      estadisticasActualizadas,
    };
    registro.info('Tareas periódicas', { ...resultado });
    responder<ResultadoTareas>(res, resultado);
  });
  return router;
}
