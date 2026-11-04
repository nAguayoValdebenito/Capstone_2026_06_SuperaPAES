// HU-39.1 (RF-A15, CU-09, RN-04, RN-05, RN-19, A24), contra PostgreSQL real: las preguntas por repasar, con el
// límite de cada plan, y el repaso, que se arma con ellas, se corrige al responder y no usa cupo.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararRespuestas } from './respuestas-de-prueba.js';
import { insertarSuscripcion } from './suscripciones-de-prueba.js';

const RUTA = '/api/v1/app/evaluaciones';

interface EstadoRepaso {
  total: number;
  limite: number | null;
  pruebas: { id: number; preguntas: number; ejes: { id: number; preguntas: number }[] }[];
}

exigirBaseEnCi();
describe.skipIf(!urlBase)('repaso de errores con PostgreSQL (HU-39.1)', () => {
  const r = prepararRespuestas('repaso');
  const { base, entorno } = r;
  const conToken = (token: string) => `Bearer ${token}`;

  const porRepasar = async (token: string) => {
    const respuesta = await request(entorno.app)
      .get(`${RUTA}/repaso`)
      .set('Authorization', conToken(token));
    expect(respuesta.status).toBe(200);
    return respuesta.body.data as EstadoRepaso;
  };
  const iniciar = (token: string, cuerpo: Record<string, unknown>) =>
    request(entorno.app).post(`${RUTA}/repasos`).set('Authorization', conToken(token)).send(cuerpo);
  const siguiente = (token: string, id: string) =>
    request(entorno.app)
      .post(`${RUTA}/practicas/${id}/siguiente`)
      .set('Authorization', conToken(token));
  const responder = async (token: string, id: string, itemId: string, letra: string) =>
    r.responderHttp(
      token,
      { practicaId: id, itemId },
      { alternativaId: await r.alternativa(itemId, letra) },
    );
  const cerrar = (token: string, id: string) =>
    request(entorno.app)
      .post(`${RUTA}/practicas/${id}/cerrar`)
      .set('Authorization', conToken(token));

  /** Responde mal `cantidad` preguntas nuevas de una práctica, que deja abierta. */
  async function fallar(token: string, cantidad: number) {
    await base.publicar(cantidad, { prueba: 'M1', dificultad: 'media' });
    const { practicaId, itemId } = await r.practicaConPregunta(token, cantidad);
    await responder(token, practicaId, itemId, 'B');
    for (let i = 1; i < cantidad; i++) {
      await responder(token, practicaId, await r.entregar(token, practicaId), 'B');
    }
    return practicaId;
  }

  /** Un estudiante cuyo plan no cuenta el cupo en M1, para fallar más preguntas de las del día. */
  async function conUnaPrueba(correo: string) {
    const sesion = await base.sesion(correo);
    await insertarSuscripcion(entorno.bd, {
      estudianteId: sesion.id,
      plan: 'Una prueba mensual',
      estado: 'activa',
      pruebas: [base.pruebaId],
    });
    return sesion;
  }

  const cupoUsado = async (id: string) => {
    const { rows } = await entorno.bd.query<{ usadas: number }>(
      'SELECT COALESCE(SUM(usadas), 0)::int AS usadas FROM app.cupo_diario WHERE estudiante_id = $1',
      [id],
    );
    return rows[0]?.usadas ?? 0;
  };

  it('sin errores no hay nada que repasar, y el plan Gratis muestra su límite', async () => {
    const { token } = await base.sesion('sin-errores@ejemplo.cl');

    expect(await porRepasar(token)).toEqual({ total: 0, limite: 10, pruebas: [] });
    const respuesta = await iniciar(token, { pruebaId: base.pruebaId });
    expect(respuesta.status).toBe(409);
  });

  it('agrupa las falladas por prueba y eje', async () => {
    const { token } = await base.sesion('agrupa@ejemplo.cl');
    await fallar(token, 5);

    const estado = await porRepasar(token);

    expect(estado).toMatchObject({ total: 5, limite: 10 });
    expect(estado.pruebas).toHaveLength(1);
    expect(estado.pruebas[0]).toMatchObject({ id: base.pruebaId, preguntas: 5 });
    expect(estado.pruebas[0]?.ejes.reduce((suma, eje) => suma + eje.preguntas, 0)).toBe(5);
  });

  it('sin el plan Todas las pruebas, solo las 10 más recientes (RN-04)', async () => {
    const { token } = await conUnaPrueba('diez@ejemplo.cl');
    await fallar(token, 12);

    const estado = await porRepasar(token);

    expect(estado).toMatchObject({ total: 12, limite: 10 });
    expect(estado.pruebas[0]?.preguntas).toBe(10);
  });

  it('con el plan Todas las pruebas se repasan todas (RF-A15)', async () => {
    const { id, token } = await base.sesion('todas@ejemplo.cl');
    await insertarSuscripcion(entorno.bd, {
      estudianteId: id,
      plan: 'Todas las pruebas mensual',
      estado: 'activa',
    });
    await fallar(token, 12);

    const estado = await porRepasar(token);

    expect(estado).toMatchObject({ total: 12, limite: null });
    expect(estado.pruebas[0]?.preguntas).toBe(12);
  });

  it('el repaso entrega las falladas, corrige al responder y no usa cupo (RN-04)', async () => {
    const { id, token } = await base.sesion('repasa@ejemplo.cl');
    await fallar(token, 5);
    const antes = await cupoUsado(id);

    const creado = await iniciar(token, { pruebaId: base.pruebaId });

    expect(creado.status).toBe(201);
    expect(creado.body.data).toMatchObject({ pruebaId: base.pruebaId, cantidad: 5, entregadas: 0 });
    const repasoId = String(creado.body.data.id as number);
    const pregunta = await siguiente(token, repasoId);
    expect(pregunta.status).toBe(200);
    expect(pregunta.body.data).toMatchObject({ orden: 1, total: 5 });

    const correcta = await responder(token, repasoId, String(pregunta.body.data.id), 'A');

    expect(correcta.status).toBe(200);
    expect(correcta.body.data.esCorrecta).toBe(true);
    expect(await cupoUsado(id)).toBe(antes);
    expect((await porRepasar(token)).total).toBe(4);
  });

  it('una pregunta fallada otra vez sigue por repasar, y el cierre entrega el resumen', async () => {
    const { token } = await base.sesion('cierra@ejemplo.cl');
    await fallar(token, 5);
    const repasoId = String(
      (await iniciar(token, { pruebaId: base.pruebaId })).body.data.id as number,
    );
    const pregunta = await siguiente(token, repasoId);
    await responder(token, repasoId, String(pregunta.body.data.id), 'B');

    const cierre = await cerrar(token, repasoId);

    expect(cierre.status).toBe(200);
    expect(cierre.body.data).toMatchObject({ respondidas: 1, correctas: 0, incorrectas: 1 });
    expect((await porRepasar(token)).total).toBe(5);
  });

  it('no repite una pregunta y avisa cuando ya entregó todas', async () => {
    const { token } = await base.sesion('completa@ejemplo.cl');
    await fallar(token, 5);
    const repasoId = String(
      (await iniciar(token, { pruebaId: base.pruebaId })).body.data.id as number,
    );

    for (let i = 0; i < 5; i++) {
      const pregunta = await siguiente(token, repasoId);
      await responder(token, repasoId, String(pregunta.body.data.id), 'B');
    }

    const { rows } = await entorno.bd.query<{ distintas: number }>(
      `SELECT COUNT(DISTINCT pregunta_id)::int AS distintas FROM app.evaluacion_item
        WHERE evaluacion_id = $1`,
      [repasoId],
    );
    expect(rows[0]?.distintas).toBe(5);
    expect((await siguiente(token, repasoId)).status).toBe(409);
  });

  it('con menos de 5 errores repasa los que hay', async () => {
    const { id, token } = await base.sesion('pocos@ejemplo.cl');
    await fallar(token, 5);
    await entorno.bd.query(
      `UPDATE app.evaluacion_item SET anulada = true
        WHERE id IN (SELECT i.id FROM app.evaluacion_item i
                       JOIN app.evaluacion e ON e.id = i.evaluacion_id
                      WHERE e.estudiante_id = $1 ORDER BY i.id LIMIT 3)`,
      [id],
    );

    const creado = await iniciar(token, { pruebaId: base.pruebaId });

    expect(creado.status).toBe(201);
    expect(creado.body.data.cantidad).toBe(2);
  });

  it('se puede repasar solo un eje, y un eje sin errores no arma nada', async () => {
    const { token } = await base.sesion('eje@ejemplo.cl');
    await fallar(token, 5);
    const eje = (await porRepasar(token)).pruebas[0]?.ejes[0];

    const creado = await iniciar(token, { pruebaId: base.pruebaId, ejeId: eje?.id });
    const vacio = await iniciar(token, { pruebaId: base.pruebaId, ejeId: 32_000 });

    expect(creado.status).toBe(201);
    expect(creado.body.data).toMatchObject({ ejeId: eje?.id, cantidad: eje?.preguntas });
    expect(vacio.status).toBe(409);
  });

  it('cierra como abandonada la práctica abierta (RN-19)', async () => {
    const { token } = await base.sesion('abandona@ejemplo.cl');
    const practicaId = await fallar(token, 5);

    expect((await iniciar(token, { pruebaId: base.pruebaId })).status).toBe(201);

    const { rows } = await entorno.bd.query<{ codigo: string }>(
      `SELECT ee.codigo FROM app.evaluacion e
         JOIN contenido.estado_evaluacion ee ON ee.id = e.estado_evaluacion_id WHERE e.id = $1`,
      [practicaId],
    );
    expect(rows[0]?.codigo).toBe('abandonada');
  });

  it('con una evaluación con tiempo abierta pide terminarla primero (RN-19)', async () => {
    const { id, token } = await base.sesion('con-tiempo@ejemplo.cl');
    await fallar(token, 5);
    await cerrar(token, (await iniciar(token, { pruebaId: base.pruebaId })).body.data.id as string);
    await base.crearEvaluacionAbierta('diagnostico', id, base.pruebaId);

    const respuesta = await iniciar(token, { pruebaId: base.pruebaId });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe('EVALUACION_CON_TIEMPO_ABIERTA');
  });

  it('el repaso de otro estudiante no se puede usar', async () => {
    const ana = await base.sesion('ana@ejemplo.cl');
    const beto = await base.sesion('beto@ejemplo.cl');
    await fallar(ana.token, 5);
    const repasoId = String(
      (await iniciar(ana.token, { pruebaId: base.pruebaId })).body.data.id as number,
    );

    expect((await siguiente(beto.token, repasoId)).status).toBe(404);
  });

  it('sin sesión responde 401 y rechaza un campo de más', async () => {
    const { token } = await base.sesion('valida@ejemplo.cl');

    expect((await request(entorno.app).get(`${RUTA}/repaso`)).status).toBe(401);
    expect((await iniciar(token, { pruebaId: base.pruebaId, cantidad: 5 })).status).toBe(400);
  });
});
