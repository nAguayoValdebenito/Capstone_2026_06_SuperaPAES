// C01 contra PostgreSQL real (HU-48, CU-25, RF-C06): indicadores del período en hora de Chile, sin datos personales.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { tasaDeAprobacion } from '../modulos/administracion/administracion.panel.servicio.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararGenerador } from './generador-bd.js';

const RUTA = '/api/v1/admin/administracion/panel';

describe('tasa de aprobación de la IA', () => {
  it('redondea el porcentaje y no inventa una tasa sin revisiones', () => {
    expect(tasaDeAprobacion(1, 3)).toBe(33);
    expect(tasaDeAprobacion(0, 0)).toBeNull();
  });
});

exigirBaseEnCi();
describe.skipIf(!urlBase)('panel con PostgreSQL (C01)', () => {
  const g = prepararGenerador('panel');

  const ver = async (periodo?: string, sesion?: Record<string, string>) => {
    const consulta = periodo ? { periodo } : {};
    return request(g.app)
      .get(RUTA)
      .query(consulta)
      .set(sesion ?? (await g.sesionAdmin()));
  };

  it('por defecto muestra 30 días, con un dato por cada día aunque no haya respuestas', async () => {
    const respuesta = await ver();

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.periodo).toBe('30d');
    expect(respuesta.body.data.respuestasPorDia).toHaveLength(30);
    expect(respuesta.body.data.ia).toEqual({ revisadas: 0, aprobadas: 0, tasa: null });
  });

  it.each([
    ['hoy', 1],
    ['7d', 7],
  ])('el período %s trae %i días', async (periodo, dias) => {
    const respuesta = await ver(periodo);

    expect(respuesta.body.data.respuestasPorDia).toHaveLength(dias);
  });

  it('este mes parte el día 1', async () => {
    const respuesta = await ver('mes');

    expect(respuesta.body.data.rango.desde).toMatch(/-01$/);
  });

  it('muestra todos los estados, también los que no tienen preguntas', async () => {
    const respuesta = await ver();

    const estados = respuesta.body.data.preguntas.porEstado as { nombre: string }[];
    expect(estados.map((e) => e.nombre)).toContain('Publicada');
  });

  it('cuenta una pregunta nueva en su estado', async () => {
    const sesion = await g.sesionAdmin();
    const antes = await ver(undefined, sesion);
    const creado = await g.pedirLote(sesion, { contenidoId: g.contenidos.m1, cantidad: 1 });
    expect(creado.status).toBe(202);
    await g.trabajador().procesarPendientes();

    const despues = await ver(undefined, sesion);

    const borradores = (r: typeof antes) =>
      (r.body.data.preguntas.porEstado as { nombre: string; total: number }[]).find(
        (e) => e.nombre === 'Borrador',
      )?.total ?? 0;
    expect(borradores(despues)).toBe(borradores(antes) + 1);
  });

  it('rechaza un período que no existe', async () => {
    expect((await ver('ayer')).status).toBe(400);
  });

  it('un docente no entra', async () => {
    const docente = await g.sesionDocente(await g.sesionAdmin());

    const respuesta = await request(g.app).get(RUTA).set(docente);

    expect(respuesta.status).toBe(403);
  });
});
