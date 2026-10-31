import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prepararMini } from './mini-ensayo-base.js';
import { evaluacionConTiempo, publicadas, marcar } from './evaluaciones-con-tiempo.js';

describe.skipIf(!process.env['DATABASE_URL_PRUEBAS'])(
  'cierre único de evaluaciones con tiempo (HU-40.2, HU-40.4)',
  () => {
    const m = prepararMini('mini_cierre');
    const { base, entorno } = m;
    const clave = 'clave-exclusiva-de-tareas-para-pruebas-hu40';
    const resultado = (token: string, id: string) =>
      request(entorno.app)
        .get(`/api/v1/app/evaluaciones/${id}/resultado`)
        .set('Authorization', `Bearer ${token}`);
    async function cerrada(id: string) {
      const { rows } = await entorno.bd.query<{
        cerrada: Date;
        vence: Date;
        recalculada: Date | null;
        total: number;
      }>(
        `SELECT e.cerrada_en AS cerrada,e.vence_en AS vence,r.recalculado_en AS recalculada,
       (SELECT count(*)::int FROM app.resultado_evaluacion WHERE evaluacion_id=e.id) AS total
       FROM app.evaluacion e JOIN app.resultado_evaluacion r ON r.evaluacion_id=e.id WHERE e.id=$1`,
        [id],
      );
      return rows[0]!;
    }

    it.each(['consultar', 'entregar'] as const)(
      'al %s tras esperar un bloqueo cierra con la hora de término',
      async (accion) => {
        const { id: estudianteId, token } = await base.sesion();
        const [id = ''] = await evaluacionConTiempo(entorno.bd, {
          estudianteId,
          pruebaId: base.pruebaId,
          tipo: 'mini_ensayo',
          preguntas: await publicadas(entorno.bd, 1),
          haceMin: 48 - 1 / 60,
        });
        await entorno.bd.query('BEGIN');
        try {
          await entorno.bd.query('SELECT id FROM app.evaluacion WHERE id=$1 FOR UPDATE', [id]);
          const pendiente = (
            accion === 'entregar'
              ? m.entregar(token, id)
              : request(entorno.app)
                  .get('/api/v1/app/evaluaciones/abierta')
                  .set('Authorization', `Bearer ${token}`)
          ).then((r) => r);
          await entorno.bd.query('SELECT pg_sleep(1.3)');
          await entorno.bd.query('COMMIT');
          const r = await pendiente;
          expect(r.status).toBe(200);
          if (accion === 'consultar')
            expect(r.body.data).toMatchObject({
              abierta: null,
              cerrada: { estado: 'tiempo_agotado' },
            });
          else expect(r.body.data.estado).toBe('tiempo_agotado');
          const fila = await cerrada(id);
          expect(fila.cerrada).toEqual(fila.vence);
          expect(fila.recalculada).toBeNull();
        } finally {
          await entorno.bd.query('ROLLBACK');
        }
      },
    );

    it('consulta concurrente y tarea periódica corrigen una sola vez y guardan las omitidas', async () => {
      const { id: estudianteId, token } = await base.sesion();
      const [id = ''] = await evaluacionConTiempo(entorno.bd, {
        estudianteId,
        pruebaId: base.pruebaId,
        tipo: 'mini_ensayo',
        preguntas: await publicadas(entorno.bd, 3),
        haceMin: 60,
      });
      const app = entorno.crearAppCon({ claveTareas: clave });
      const rs = await Promise.all([
        resultado(token, id),
        resultado(token, id),
        request(app).post('/api/v1/tareas/periodicas').set('Authorization', `Bearer ${clave}`),
      ]);
      expect(rs.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(rs[0].body.data).toEqual(rs[1].body.data);
    expect(rs[0].body.data.omitidas).toBe(3);
      const fila = await cerrada(id);
      expect(fila).toMatchObject({ total: 1, recalculada: null });
      expect(fila.cerrada).toEqual(fila.vence);
      const repetir = await m.entregar(token, id);
      expect(repetir.status).toBe(200);
      expect(await cerrada(id)).toEqual(fila);
    });

    it('el cierre común excluye anuladas y no puntuables y lleva omitidas al repaso', async () => {
      const { id: estudianteId, token } = await base.sesion();
      const preguntas = await publicadas(entorno.bd, 4);
      const [id = '', bien = '', omitida = '', anulada = '', sinPuntaje = ''] =
        await evaluacionConTiempo(entorno.bd, {
          estudianteId,
          pruebaId: base.pruebaId,
          tipo: 'ensayo',
          preguntas,
        });
      await marcar(entorno.bd, bien, 'A');
      await entorno.bd.query('UPDATE app.evaluacion_item SET puntuable=false WHERE id=$1', [
        sinPuntaje,
      ]);
      await entorno.bd.query(
        'SELECT app.anular_pregunta(pregunta_id) FROM app.evaluacion_item WHERE id=$1',
        [anulada],
      );
      expect((await m.entregar(token, id)).status).toBe(200);
      const r = await resultado(token, id);
      expect(r.body.data).toMatchObject({
        correctas: 1,
        incorrectas: 0,
        omitidas: 1,
        porcentaje: 50,
      });
      const { rows } = await entorno.bd.query(
        'SELECT es_correcta FROM app.evaluacion_item WHERE id=$1',
        [omitida],
      );
      expect(rows[0]?.es_correcta).toBe(false);
      const falladas = await entorno.bd.query(
        `SELECT f.pregunta_id::text FROM app.v_preguntas_falladas f
      JOIN app.evaluacion_item i ON i.pregunta_id=f.pregunta_id WHERE f.estudiante_id=$1 AND i.id=$2`,
        [estudianteId, omitida],
      );
      expect(falladas.rows).toHaveLength(1);
    });
  },
);
