import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prepararMini } from './mini-ensayo-base.js';

describe.skipIf(!process.env['DATABASE_URL_PRUEBAS'])('inicio del diagnóstico (HU-36.1)', () => {
  const m = prepararMini('diagnostico_inicio');
  const { base, entorno } = m;
  const iniciar = (token: string, pruebaId = base.pruebaId) =>
    request(entorno.app)
      .post('/api/v1/app/evaluaciones/diagnosticos')
      .set('Authorization', `Bearer ${token}`)
      .send({ pruebaId });
  const disponibilidad = (token: string, pruebaId = base.pruebaId) =>
    request(entorno.app)
      .get('/api/v1/app/evaluaciones/diagnosticos/disponibilidad')
      .query({ pruebaId })
      .set('Authorization', `Bearer ${token}`);

  it('informa disponible y después ya rendido, también si fue abandonado', async () => {
    const ana = await base.sesion('ana@ejemplo.cl');
    const beto = await base.sesion('beto@ejemplo.cl');
    const antes = await disponibilidad(ana.token);
    expect(antes.status).toBe(200);
    expect(antes.body.data).toMatchObject({
      pruebaId: base.pruebaId,
      disponible: true,
      motivo: null,
    });
    const id = await base.crearEvaluacionAbierta('diagnostico', ana.id, base.pruebaId);
    await entorno.bd.query("SELECT app.cerrar_evaluacion($1,'abandonada')", [id]);
    const despues = await disponibilidad(ana.token);
    expect(despues.body.data).toMatchObject({
      anioEscolar: antes.body.data.anioEscolar,
      disponible: false,
      motivo: 'ya_rendido',
    });
    expect((await disponibilidad(beto.token)).body.data.disponible).toBe(true);
  });

  it('un banco insuficiente no consume el diagnóstico anual y permite reintentar', async () => {
    const { token, id } = await base.sesion(undefined, undefined, 2020);
    const falta = await iniciar(token);
    expect(falta.status).toBe(409);
    expect(falta.body.error.codigo).toBe('SIN_PREGUNTAS_SUFICIENTES');
    expect(await m.cantidades(id)).toEqual({ evaluaciones: 0, usos: 0 });

    await m.banco();
    const reintento = await iniciar(token);
    expect(reintento.status).toBe(201);
    expect(reintento.body.data).toMatchObject({ cantidad: 20, duracionMin: 44 });
    expect(JSON.stringify(reintento.body)).not.toMatch(
      /alternativaCorrecta|esCorrecta|explicacion/,
    );
    expect(await m.cantidades(id)).toEqual({ evaluaciones: 1, usos: 0 });
  });

  it.each(['practica', 'repaso'] as const)(
    'cierra un %s abierto como abandonado antes del diagnóstico',
    async (tipo) => {
      await m.banco();
      const { token, id } = await base.sesion(undefined, undefined, 2020);
      let anterior: string;
      if (tipo === 'practica') {
        const practica = await base.inicio(token, {
          pruebaId: base.pruebaId,
          cantidad: 5,
          dificultadId: base.mediaId,
        });
        anterior = String(practica.body.data.id);
        const pregunta = await base.siguiente(token, anterior);
        await base.responder(String(pregunta.body.data.id));
      } else anterior = await m.repasoRespondido(token, id);
      const r = await iniciar(token);
      expect(r.status).toBe(201);
      expect(await m.estado(anterior)).toBe('abandonada');
    },
  );

  it('rechaza el inicio si hay otra evaluación con tiempo abierta', async () => {
    const { token, id } = await base.sesion();
    const anterior = await base.crearEvaluacionAbierta('diagnostico', id, base.pruebaId);
    const r = await iniciar(token);
    expect(r.status).toBe(409);
    expect(r.body.error.codigo).toBe('EVALUACION_CON_TIEMPO_ABIERTA');
    expect(String(r.body.error.detalles.abierta.id)).toBe(anterior);
    expect(await m.cantidades(id)).toEqual({ evaluaciones: 1, usos: 0 });
  });

  it('dos inicios simultáneos crean uno solo: 201 y 409, sin uso gratis', async () => {
    await m.banco();
    const { token, id } = await base.sesion(undefined, undefined, 2020);
    const respuestas = await Promise.all([iniciar(token), iniciar(token)]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await m.cantidades(id)).toEqual({ evaluaciones: 1, usos: 0 });
    const cerrada = respuestas.find((r) => r.status === 201)!;
    await entorno.bd.query("SELECT app.cerrar_evaluacion($1,'entregada')", [cerrada.body.data.id]);
    const otra = await iniciar(token);
    expect(otra.status).toBe(409);
    expect(otra.body.error.codigo).toBe('DIAGNOSTICO_YA_RENDIDO');
  });

  it('28 de febrero y 1 de marzo en Chile pertenecen a años escolares distintos', async () => {
    const { token, id } = await base.sesion(undefined, undefined, 2020);
    const { rows: anios } = await entorno.bd.query<{ actual: number }>(
      'SELECT app.anio_escolar(app.hoy_chile()) AS actual',
    );
    const actual = anios[0]!.actual;
    const crearEn = async (instante: string) => {
      const { rows } = await entorno.bd.query<{ id: string; anio: number }>(
        `INSERT INTO app.evaluacion
         (estudiante_id,tipo_evaluacion_id,unica_por_anio_escolar,prueba_id,estructura_id,
          anio_escolar,cantidad_preguntas,duracion_min,estado_evaluacion_id,iniciada_en,vence_en)
         SELECT $1,t.id,true,$2,s.id,0,s.cantidad_min,s.duracion_min,e.id,
           $3::timestamp AT TIME ZONE 'America/Santiago',
           ($3::timestamp AT TIME ZONE 'America/Santiago')+s.duracion_min*INTERVAL '1 minute'
         FROM contenido.tipo_evaluacion t JOIN contenido.estructura_evaluacion s ON s.tipo_evaluacion_id=t.id
         CROSS JOIN contenido.estado_evaluacion e
         WHERE t.codigo='diagnostico' AND s.prueba_id=$2 AND e.codigo='en_curso'
         RETURNING id::text,anio_escolar AS anio`,
        [id, base.pruebaId, instante],
      );
      const fila = rows[0]!;
      await entorno.bd.query("SELECT app.cerrar_evaluacion($1,'tiempo_agotado')", [fila.id]);
      return fila.anio;
    };
    expect(await crearEn(`${actual}-02-28 23:59:59`)).toBe(actual - 1);
    expect(await crearEn(`${actual}-03-01 00:00:00`)).toBe(actual);
    expect((await disponibilidad(token)).body.data).toMatchObject({
      anioEscolar: actual,
      disponible: false,
      motivo: 'ya_rendido',
    });
    expect(await m.cantidades(id)).toEqual({ evaluaciones: 2, usos: 0 });
  });
});
