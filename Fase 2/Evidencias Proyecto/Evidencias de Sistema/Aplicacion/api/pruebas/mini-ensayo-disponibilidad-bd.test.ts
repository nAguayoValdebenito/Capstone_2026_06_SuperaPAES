import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prepararMini } from './mini-ensayo-base.js';
import { insertarSuscripcion } from './suscripciones-de-prueba.js';

describe.skipIf(!process.env['DATABASE_URL_PRUEBAS'])(
  'disponibilidad del mini-ensayo (HU-40.3)',
  () => {
    const m = prepararMini('mini_disponibilidad');
    const { base, entorno } = m;
    const disponibilidad = (token: string, pruebaId: number | string = base.pruebaId) =>
      request(entorno.app)
        .get('/api/v1/app/evaluaciones/mini-ensayos/disponibilidad')
        .query({ pruebaId })
        .set('Authorization', `Bearer ${token}`);

    it('antes de empezar muestra la estructura y el uso gratis, sin gastarlo', async () => {
      const { token, id } = await base.sesion(undefined, undefined, 2020);
      const r = await disponibilidad(token);
      expect(r.status).toBe(200);
      expect(r.body.data).toEqual({
        pruebaId: base.pruebaId,
        cantidad: 22,
        duracionMin: 48,
        ejes: 4,
        habilidades: 0,
        conPlan: false,
        gratisRestantes: 1,
        disponible: true,
        motivo: null,
      });
      expect(await m.cantidades(id)).toEqual({ evaluaciones: 0, usos: 0 });
    });

    it('después del uso gratis del mes informa el límite mensual', async () => {
      await m.banco();
      const { token } = await base.sesion(undefined, undefined, 2020);
      const inicio = await m.iniciar(token);
      expect(inicio.status).toBe(201);
      await m.entregar(token, (inicio.body as { data: { id: number } }).data.id);
      expect((await disponibilidad(token)).body.data).toMatchObject({
        conPlan: false,
        gratisRestantes: 0,
        disponible: false,
        motivo: 'limite_mensual',
      });
    });

    it('con una suscripción que cubre la prueba no tiene límite (RN-04)', async () => {
      await m.banco();
      const { token, id } = await base.sesion(undefined, undefined, 2020);
      await insertarSuscripcion(entorno.bd, {
        estudianteId: id,
        plan: 'Todas las pruebas mensual',
        estado: 'activa',
      });
      const inicio = await m.iniciar(token);
      await m.entregar(token, (inicio.body as { data: { id: number } }).data.id);
      expect((await disponibilidad(token)).body.data).toMatchObject({
        conPlan: true,
        gratisRestantes: null,
        disponible: true,
        motivo: null,
      });
    });

    it('cada estudiante ve sus propios usos', async () => {
      await m.banco();
      const ana = await base.sesion('ana@ejemplo.cl', undefined, 2020);
      const beto = await base.sesion('beto@ejemplo.cl', undefined, 2020);
      expect((await m.iniciar(ana.token)).status).toBe(201);
      expect((await disponibilidad(beto.token)).body.data).toMatchObject({
        gratisRestantes: 1,
        disponible: true,
      });
    });

    it('rechaza una prueba que no eligió o un filtro inválido', async () => {
      const { token } = await base.sesion();
      expect((await disponibilidad(token, base.lectoraId)).status).toBe(400);
      expect((await disponibilidad(token, 'M1')).status).toBe(400);
    });
  },
);
