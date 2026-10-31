import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prepararMini } from './mini-ensayo-base.js';
import { evaluacionConTiempo, publicadas } from './evaluaciones-con-tiempo.js';

describe.skipIf(!process.env['DATABASE_URL_PRUEBAS'])(
  'respuestas y entrega con tiempo (HU-40.1)',
  () => {
    const m = prepararMini('mini_respuestas');
    const { base, entorno } = m;
    const responder = (
      token: string,
      id: string | number,
      item: string | number,
      alternativaId: number,
    ) =>
      request(entorno.app)
        .post(`/api/v1/app/evaluaciones/${id}/items/${item}/respuesta`)
        .set('Authorization', `Bearer ${token}`)
        .send({ alternativaId });
    const abierta = (token: string) =>
      request(entorno.app)
        .get('/api/v1/app/evaluaciones/abierta')
        .set('Authorization', `Bearer ${token}`);
    async function alternativas(item: string | number) {
      const { rows } = await entorno.bd.query<{ id: number }>(
        `SELECT a.id::int FROM app.evaluacion_item i
      JOIN contenido.alternativa a ON a.pregunta_id=i.pregunta_id WHERE i.id=$1 ORDER BY a.letra`,
        [item],
      );
      return rows.map((a) => a.id);
    }
    async function casiVencida(estudianteId: string, segundos: number) {
      return evaluacionConTiempo(entorno.bd, {
        estudianteId,
        pruebaId: base.pruebaId,
        tipo: 'mini_ensayo',
        preguntas: await publicadas(entorno.bd, 1),
        haceMin: 48 - segundos / 60,
      });
    }

    it('guarda la última respuesta sin corregir, retoma con ítems y corrige al entregar', async () => {
      await m.banco();
      const { token, id: estudianteId } = await base.sesion(undefined, undefined, 2020);
      const inicio = await m.iniciar(token);
      const id = inicio.body.data.id as number;
      const item = inicio.body.data.preguntas[0].id as number;
      const [a = 0, b = 0] = await alternativas(item);
      for (const alternativaId of [a, b]) {
        const r = await responder(token, id, item, alternativaId);
        expect(r.status).toBe(200);
        expect(r.body.data.alternativaElegidaId).toBe(alternativaId);
        expect(JSON.stringify(r.body)).not.toMatch(/alternativaCorrecta|explicacion|esCorrecta/);
      }
      const guardado = await entorno.bd.query(
        'SELECT es_correcta,veces_cambiada,tipo_consumo_id FROM app.evaluacion_item WHERE id=$1',
        [item],
      );
      expect(guardado.rows[0]).toEqual({
        es_correcta: null,
        veces_cambiada: 1,
        tipo_consumo_id: null,
      });
      const consulta = await abierta(token);
      expect(consulta.body.data.abierta.preguntas).toHaveLength(22);
      expect(consulta.body.data.abierta.preguntas[0].alternativaElegidaId).toBe(b);
      expect(consulta.body.data.abierta.segundosRestantes).toBeGreaterThan(0);
      expect(JSON.stringify(consulta.body)).not.toMatch(
        /alternativaCorrecta|explicacion|esCorrecta/,
      );
      expect((await m.entregar(token, id)).status).toBe(200);
      const resultado = await request(entorno.app)
        .get(`/api/v1/app/evaluaciones/${id}/resultado`)
        .set('Authorization', `Bearer ${token}`);
      expect(resultado.status).toBe(200);
      expect(resultado.body.data).toMatchObject({ correctas: 0, incorrectas: 1, omitidas: 21 });
      expect((await responder(token, id, item, a)).status).toBe(409);
      expect(await m.cantidades(estudianteId)).toEqual({ evaluaciones: 1, usos: 1 });
    });

    it('acepta antes del plazo y rechaza justo después, dentro de los 10 segundos del trigger', async () => {
      const { token, id: estudianteId } = await base.sesion();
      const [id = '', item = ''] = await casiVencida(estudianteId, 1.2);
      const [a = 0, b = 0] = await alternativas(item);
      expect((await responder(token, id, item, a)).status).toBe(200);
      await entorno.bd.query('SELECT pg_sleep(1.3)');
      const tarde = await responder(token, id, item, b);
      expect(tarde.status).toBe(409);
      expect(tarde.body.error.codigo).toBe('EVALUACION_CERRADA');
      expect(
        (
          await entorno.bd.query(
            'SELECT alternativa_id::int AS id FROM app.evaluacion_item WHERE id=$1',
            [item],
          )
        ).rows[0]?.id,
      ).toBe(a);
    });

    it('vuelve a leer clock_timestamp tras esperar el bloqueo y rechaza la respuesta tardía', async () => {
      const { token, id: estudianteId } = await base.sesion();
      const [id = '', item = ''] = await casiVencida(estudianteId, 1);
      const [a = 0] = await alternativas(item);
      await entorno.bd.query('BEGIN');
      try {
        await entorno.bd.query('SELECT id FROM app.evaluacion WHERE id=$1 FOR UPDATE', [id]);
        const pendiente = responder(token, id, item, a).then((r) => r);
        await entorno.bd.query('SELECT pg_sleep(1.3)');
        await entorno.bd.query('COMMIT');
        const r = await pendiente;
        expect(r.status).toBe(409);
        expect(r.body.error.codigo).toBe('EVALUACION_CERRADA');
        expect(
          (
            await entorno.bd.query('SELECT alternativa_id FROM app.evaluacion_item WHERE id=$1', [
              item,
            ])
          ).rows[0]?.alternativa_id,
        ).toBeNull();
      } finally {
        await entorno.bd.query('ROLLBACK');
      }
    });

    it('otro estudiante no puede ver, responder ni entregar la evaluación ajena', async () => {
      const ana = await base.sesion('ana@ejemplo.cl');
      const beto = await base.sesion('beto@ejemplo.cl');
      const [id = '', item = ''] = await casiVencida(ana.id, 100);
      const [a = 0] = await alternativas(item);
      expect((await abierta(beto.token)).body.data.abierta).toBeNull();
      expect((await responder(beto.token, id, item, a)).status).toBe(404);
      expect((await m.entregar(beto.token, id)).status).toBe(404);
      expect(
        (await request(entorno.app).post(`/api/v1/app/evaluaciones/${id}/entregar`)).status,
      ).toBe(401);
    });
  },
);
