import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prepararMini } from './mini-ensayo-base.js';
import { insertarSuscripcion } from './suscripciones-de-prueba.js';

describe.skipIf(!process.env['DATABASE_URL_PRUEBAS'])('ensayo completo: inicio (HU-42.1)', () => {
  const m = prepararMini('ensayo_inicio');
  const { base, entorno } = m;
  const iniciar = (token: string, pruebaId = base.pruebaId) =>
    request(entorno.app).post('/api/v1/app/evaluaciones/ensayos').set('Authorization', `Bearer ${token}`).send({ pruebaId });
  const disponible = (token: string) =>
    request(entorno.app).get(`/api/v1/app/evaluaciones/ensayos/disponibilidad?pruebaId=${base.pruebaId}`).set('Authorization', `Bearer ${token}`);

  it('exige plan Todas las pruebas incluso si Una prueba cubre M1', async () => {
    const { id, token } = await base.sesion();
    await insertarSuscripcion(entorno.bd, { estudianteId: id, plan: 'Una prueba mensual', estado: 'activa', pruebas: [base.pruebaId] });
    const r = await iniciar(token);
    expect(r.status).toBe(403);
    expect(r.body.error).toMatchObject({ codigo: 'SIN_PERMISO', detalles: { motivo: 'plan_todas_requerido' } });
    expect((await disponible(token)).body.data).toMatchObject({ disponible: false, motivo: 'plan_todas_requerido' });
  });

  it('banco insuficiente revierte todo y deja reintentar', async () => {
    const { id, token } = await base.sesion();
    await insertarSuscripcion(entorno.bd, { estudianteId: id, plan: 'Todas las pruebas mensual', estado: 'activa' });
    const r = await iniciar(token);
    expect(r.status).toBe(409);
    expect(r.body.error.codigo).toBe('SIN_PREGUNTAS_SUFICIENTES');
    expect(await m.cantidades(id)).toEqual({ evaluaciones: 0, usos: 0 });
    await m.banco('M1', 8);
    expect((await iniciar(token)).status).toBe(201);
  });

  it('arma 65 preguntas, oculta las no puntuables y permite retomarlo', async () => {
    await m.banco('M1', 8);
    const { id, token } = await base.sesion(undefined, undefined, 2029);
    await insertarSuscripcion(entorno.bd, { estudianteId: id, plan: 'Todas las pruebas mensual', estado: 'en_mora' });
    const d = await disponible(token);
    expect(d.status).toBe(200);
    expect(d.body.data).toMatchObject({ cantidad: 65, duracionMin: 140, disponible: true });
    const r = await iniciar(token);
    expect(r.status).toBe(201);
    expect(r.body.data.preguntas).toHaveLength(65);
    const abierta = await request(entorno.app).get('/api/v1/app/evaluaciones/abierta').set('Authorization', `Bearer ${token}`);
    for (const body of [d.body, r.body, abierta.body]) expect(JSON.stringify(body)).not.toMatch(/puntuable|noPuntuables|alternativaCorrecta|esCorrecta/);
    const { rows } = await entorno.bd.query<{ total: number; noPuntuables: number; distintas: number }>(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE NOT puntuable)::int AS "noPuntuables", count(DISTINCT pregunta_id)::int AS distintas FROM app.evaluacion_item WHERE evaluacion_id=$1`, [r.body.data.id],
    );
    expect(rows[0]).toEqual({ total: 65, noPuntuables: 5, distintas: 65 });
    expect(String(abierta.body.data.abierta.id)).toBe(String(r.body.data.id));
  });

  it.each([['M2', 55, 140], ['HCS', 65, 120]] as const)(
    '%s conserva el formato oficial de %i preguntas y %i minutos',
    async (codigo, cantidad, duracionMin) => {
      const contenidos = await m.banco(codigo, 10);
      const { rows: [prueba] } = await entorno.bd.query<{ id: number }>(
        'SELECT id FROM contenido.prueba WHERE codigo=$1', [codigo],
      );
      const { id, token } = await base.sesion(undefined, [prueba!.id], 2029);
      await insertarSuscripcion(entorno.bd, { estudianteId: id, plan: 'Todas las pruebas mensual', estado: 'activa' });
      const r = await iniciar(token, prueba!.id);
      expect(r.status, JSON.stringify(r.body.error)).toBe(201);
      expect(r.body.data).toMatchObject({ cantidad, duracionMin });
      expect(r.body.data.preguntas).toHaveLength(cantidad);
      expect(contenidos.length).toBeGreaterThan(0);
      const { rows: [fila] } = await entorno.bd.query<{ noPuntuables: number }>(
        'SELECT count(*) FILTER (WHERE NOT puntuable)::int AS "noPuntuables" FROM app.evaluacion_item WHERE evaluacion_id=$1',
        [r.body.data.id],
      );
      expect(fila!.noPuntuables).toBe(5);
    },
  );

  it('Ciencias exige electivo y sortea una sin puntaje por eje común y dos del electivo', async () => {
    const contenidos = await m.banco('CIE', 20);
    const { rows: [prueba] } = await entorno.bd.query<{ id: number }>(
      "SELECT id FROM contenido.prueba WHERE codigo='CIE'",
    );
    const { id, token } = await base.sesion(undefined, [prueba!.id], 2029);
    await insertarSuscripcion(entorno.bd, { estudianteId: id, plan: 'Todas las pruebas mensual', estado: 'activa' });
    const falta = await iniciar(token, prueba!.id);
    expect(falta.status).toBe(400);
    expect(falta.body.error.detalles[0].motivo).toBe('electivo_requerido');
    await entorno.bd.query(
      'UPDATE app.estudiante_prueba SET electivo_area_id=$2 WHERE estudiante_id=$1 AND prueba_id=$3',
      [id, contenidos[0]!.areaId, prueba!.id],
    );
    const r = await iniciar(token, prueba!.id);
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ cantidad: 80, duracionMin: 160 });
    const { rows } = await entorno.bd.query<{ eje: number; total: number; noPuntuables: number }>(
      `SELECT v.eje_id AS eje,count(*)::int AS total,
        count(*) FILTER (WHERE NOT i.puntuable)::int AS "noPuntuables"
       FROM app.evaluacion_item i JOIN contenido.pregunta_version v
       ON (v.pregunta_id,v.version)=(i.pregunta_id,i.version_pregunta)
       WHERE i.evaluacion_id=$1 GROUP BY v.eje_id ORDER BY v.eje_id`, [r.body.data.id],
    );
    expect(rows.map((e) => e.total).sort((a,b) => a-b)).toEqual([18,18,44]);
    expect(rows.map((e) => e.noPuntuables).sort((a,b) => a-b)).toEqual([1,1,3]);
  });

  it('dos inicios simultáneos crean uno solo', async () => {
    await m.banco('M1', 8);
    const { id, token } = await base.sesion(undefined, undefined, 2029);
    await insertarSuscripcion(entorno.bd, { estudianteId: id, plan: 'Todas las pruebas mensual', estado: 'activa' });
    const respuestas = await Promise.all([iniciar(token), iniciar(token)]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await m.cantidades(id)).toEqual({ evaluaciones: 1, usos: 0 });
  });
});
