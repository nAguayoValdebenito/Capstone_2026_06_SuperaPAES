import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prepararMini } from './mini-ensayo-base.js';
import { evaluacionConTiempo, marcar } from './evaluaciones-con-tiempo.js';
import { crearPreguntaPublicada } from './preguntas-de-prueba.js';

describe.skipIf(!process.env['DATABASE_URL_PRUEBAS'])('resultado del diagnóstico (HU-36.3)', () => {
  const m = prepararMini('diagnostico_resultado');
  const { base, entorno } = m;
  const obtener = (token: string, ruta: string) =>
    request(entorno.app)
      .get(`/api/v1/app/evaluaciones${ruta}`)
      .set('Authorization', `Bearer ${token}`);

  it('retoma sin claves y al entregar marca los ejes con la misma regla del progreso', async () => {
    await m.banco();
    const ana = await base.sesion('ana@ejemplo.cl', undefined, 2020);
    const beto = await base.sesion('beto@ejemplo.cl', undefined, 2020);
    const inicio = await request(entorno.app)
      .post('/api/v1/app/evaluaciones/diagnosticos')
      .set('Authorization', `Bearer ${ana.token}`)
      .send({ pruebaId: base.pruebaId });
    expect(inicio.status).toBe(201);
    const id = inicio.body.data.id as number;
    const item = inicio.body.data.preguntas[0].id as number;
    const { rows: alternativas } = await entorno.bd.query<{ id: number }>(
      `SELECT a.id::int FROM app.evaluacion_item i JOIN contenido.alternativa a ON a.pregunta_id=i.pregunta_id
       WHERE i.id=$1 AND a.letra='B'`,
      [item],
    );
    const respuesta = await request(entorno.app)
      .post(`/api/v1/app/evaluaciones/${id}/items/${item}/respuesta`)
      .set('Authorization', `Bearer ${ana.token}`)
      .send({ alternativaId: alternativas[0]!.id });
    expect(respuesta.status).toBe(200);
    expect(JSON.stringify(respuesta.body)).not.toMatch(
      /alternativaCorrecta|esCorrecta|explicacion/,
    );
    const abierta = await obtener(ana.token, '/abierta');
    expect(abierta.body.data.abierta.tipo.codigo).toBe('diagnostico');
    expect(abierta.body.data.abierta.preguntas).toHaveLength(20);
    expect(JSON.stringify(abierta.body)).not.toMatch(/alternativaCorrecta|esCorrecta|explicacion/);
    expect((await obtener(ana.token, `/${id}/resultado`)).status).toBe(409);
    expect((await obtener(beto.token, '/abierta')).body.data.abierta).toBeNull();
    expect((await obtener(beto.token, `/${id}/resultado`)).status).toBe(404);
    expect((await m.entregar(ana.token, id)).status).toBe(200);

    const resultado = await obtener(ana.token, `/${id}/resultado`);
    const progreso = await obtener(ana.token, '/progreso');
    expect(resultado.status).toBe(200);
    expect(resultado.body.data).toMatchObject({
      tipo: { codigo: 'diagnostico' },
      correctas: 0,
      incorrectas: 1,
      omitidas: 19,
      puntaje: null,
    });
    const ejes = resultado.body.data.ejes as { id: number; aReforzar: boolean }[];
    const progresoEjes = progreso.body.data.pruebas[0].ejes as { id: number; aReforzar: boolean }[];
    expect(ejes).toHaveLength(4);
    expect(ejes.map((e) => [e.id, e.aReforzar])).toEqual(
      progresoEjes.map((e) => [e.id, e.aReforzar]),
    );
    expect(ejes.every((e) => e.aReforzar)).toBe(true);
    expect(resultado.body.data.ejesAReforzar).toEqual(ejes.map((e) => e.id));
    expect((await obtener(beto.token, `/${id}/resultado`)).status).toBe(404);
    expect(await m.cantidades(ana.id)).toEqual({ evaluaciones: 1, usos: 0 });
    const { rows: cupos } = await entorno.bd.query<{ total: number }>(
      'SELECT count(*)::int AS total FROM app.cupo_diario WHERE estudiante_id=$1',
      [ana.id],
    );
    expect(cupos[0]?.total).toBe(0);
  });

  it('considera respuestas previas al marcar un eje del resultado', async () => {
    const contenidos = await m.banco();
    const { token, id: estudianteId } = await base.sesion(undefined, undefined, 2020);
    const previas = [];
    for (let i = 0; i < 5; i++)
      previas.push(
        await crearPreguntaPublicada(entorno.bd, {
          prueba: 'M1',
          dificultad: 'media',
          contenidoId: contenidos[0]!.id,
        }),
      );
    const [mini = '', ...itemsPrevios] = await evaluacionConTiempo(entorno.bd, {
      estudianteId,
      pruebaId: base.pruebaId,
      tipo: 'mini_ensayo',
      preguntas: previas,
    });
    for (const item of itemsPrevios) await marcar(entorno.bd, item, 'B');
    await entorno.bd.query("SELECT app.cerrar_evaluacion($1,'entregada')", [mini]);
    const inicio = await request(entorno.app)
      .post('/api/v1/app/evaluaciones/diagnosticos')
      .set('Authorization', `Bearer ${token}`)
      .send({ pruebaId: base.pruebaId });
    expect(inicio.status).toBe(201);
    const diagnostico = inicio.body.data.id as number;
    const { rows: delEje } = await entorno.bd.query<{ id: string }>(
      `SELECT i.id::text FROM app.evaluacion_item i
       JOIN contenido.pregunta_version v ON (v.pregunta_id,v.version)=(i.pregunta_id,i.version_pregunta)
       WHERE i.evaluacion_id=$1 AND v.eje_id=$2`,
      [diagnostico, contenidos[0]!.ejeId],
    );
    expect(delEje).toHaveLength(5);
    for (const item of delEje) await marcar(entorno.bd, item.id, 'A');
    expect((await m.entregar(token, diagnostico)).status).toBe(200);
    const resultado = (await obtener(token, `/${diagnostico}/resultado`)).body.data;
    const ejes = resultado.ejes as {
      id: number;
      preguntas: number;
      correctas: number;
      aReforzar: boolean;
    }[];
    const eje = ejes.find((e) => e.id === contenidos[0]!.ejeId);
    expect(eje).toMatchObject({ preguntas: 5, correctas: 5, aReforzar: true });
    expect(resultado.ejesAReforzar as number[]).toContain(eje!.id);

    await entorno.bd.query(
      `UPDATE contenido.contenido_tematico
       SET nivel_escolar_id=(SELECT id FROM contenido.nivel_escolar WHERE anios_para_egreso=0)
       WHERE eje_id=$1`,
      [eje!.id],
    );
    await entorno.bd.query(
      'UPDATE app.estudiante SET anio_egreso=app.anio_escolar(app.hoy_chile())+3 WHERE id=$1',
      [estudianteId],
    );
    const conCurso = (await obtener(token, `/${diagnostico}/resultado`)).body.data as {
      ejes: { id: number; aReforzar: boolean }[];
      ejesAReforzar: number[];
    };
    expect(conCurso.ejes.find((e) => e.id === eje!.id)?.aReforzar).toBe(false);
    expect(conCurso.ejesAReforzar).not.toContain(eje!.id);
  });
});
