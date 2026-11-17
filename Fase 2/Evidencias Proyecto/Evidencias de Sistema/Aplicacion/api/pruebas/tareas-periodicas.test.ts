// Ruta de las tareas periódicas sin base (DAS 4.3.5): después de cerrar las evaluaciones vencidas
// recalcula las estadísticas por pregunta (HU-53.1, RF-G13), para que cuenten las recién corregidas.
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearRutasTareas, type TareasPeriodicas } from '../trabajos/tareas-periodicas.js';

// Valor de prueba, no es un secreto. secretlint-disable-next-line
const CLAVE = 'clave-de-tareas-de-prueba-sin-base-32';

function appCon(tareas: TareasPeriodicas) {
  const app = express();
  app.use('/tareas', crearRutasTareas(CLAVE, tareas));
  return app;
}

describe('tareas periódicas: estadísticas por pregunta (HU-53.1)', () => {
  it('recalcula las estadísticas después de cerrar las vencidas e informa cuántas cambiaron', async () => {
    const orden: string[] = [];
    const app = appCon({
      cerrarVencidas: () => {
        orden.push('cerrar');
        return Promise.resolve(3);
      },
      cerrarCanceladasVencidas: () => Promise.resolve(0),
      avisarRenovaciones: () => Promise.resolve({ enviados: 0, fallidos: 0 }),
      recalcularEstadisticas: () => {
        orden.push('estadisticas');
        return Promise.resolve(7);
      },
    });

    const respuesta = await request(app)
      .post('/tareas/periodicas')
      .set('Authorization', `Bearer ${CLAVE}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({
      evaluacionesCerradas: 3,
      suscripcionesCanceladas: 0,
      avisosRenovacion: 0,
      avisosRenovacionFallidos: 0,
      estadisticasActualizadas: 7,
    });
    expect(orden).toEqual(['cerrar', 'estadisticas']);
  });
});
