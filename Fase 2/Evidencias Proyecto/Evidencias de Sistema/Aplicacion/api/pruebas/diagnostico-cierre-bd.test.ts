import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prepararMini } from './mini-ensayo-base.js';
import { evaluacionConTiempo, publicadas } from './evaluaciones-con-tiempo.js';

describe.skipIf(!process.env['DATABASE_URL_PRUEBAS'])('cierre del diagnóstico (HU-36.3)', () => {
  const m = prepararMini('diagnostico_cierre');
  const { base, entorno } = m;
  const resultado = (token: string, id: string) =>
    request(entorno.app)
      .get(`/api/v1/app/evaluaciones/${id}/resultado`)
      .set('Authorization', `Bearer ${token}`);

  it('al consultar la abierta vencida cierra con su hora de término y cuenta como rendido', async () => {
    const { id: estudianteId, token } = await base.sesion();
    const [id = ''] = await evaluacionConTiempo(entorno.bd, {
      estudianteId,
      pruebaId: base.pruebaId,
      tipo: 'diagnostico',
      preguntas: await publicadas(entorno.bd, 1),
      haceMin: 60,
    });
    const abierta = await request(entorno.app)
      .get('/api/v1/app/evaluaciones/abierta')
      .set('Authorization', `Bearer ${token}`);
    expect(abierta.body.data).toMatchObject({
      abierta: null,
      cerrada: { id: Number(id), estado: 'tiempo_agotado' },
    });
    const r = await resultado(token, id);
    expect(r.body.data).toMatchObject({ omitidas: 1, estado: { codigo: 'tiempo_agotado' } });
    const { rows } = await entorno.bd.query<{ cerrada: Date; vence: Date }>(
      'SELECT cerrada_en AS cerrada,vence_en AS vence FROM app.evaluacion WHERE id=$1',
      [id],
    );
    expect(rows[0]!.cerrada).toEqual(rows[0]!.vence);
    const disponibilidad = await request(entorno.app)
      .get('/api/v1/app/evaluaciones/diagnosticos/disponibilidad')
      .query({ pruebaId: base.pruebaId })
      .set('Authorization', `Bearer ${token}`);
    expect(disponibilidad.body.data).toMatchObject({ disponible: false, motivo: 'ya_rendido' });
  });

  it('la tarea periódica cierra y corrige un diagnóstico vencido', async () => {
    const { id: estudianteId, token } = await base.sesion();
    const [id = ''] = await evaluacionConTiempo(entorno.bd, {
      estudianteId,
      pruebaId: base.pruebaId,
      tipo: 'diagnostico',
      preguntas: await publicadas(entorno.bd, 3),
      haceMin: 60,
    });
    const clave = 'tareas-diagnostico-pruebas';
    const app = entorno.crearAppCon({ claveTareas: clave });
    const tarea = await request(app)
      .post('/api/v1/tareas/periodicas')
      .set('Authorization', `Bearer ${clave}`);
    expect(tarea.status).toBe(200);
    expect(tarea.body.data.evaluacionesCerradas).toBe(1);
    const r = await resultado(token, id);
    expect(r.body.data).toMatchObject({ omitidas: 3, estado: { codigo: 'tiempo_agotado' } });
    expect((await m.entregar(token, id)).body.data.estado).toBe('tiempo_agotado');
  });
});
