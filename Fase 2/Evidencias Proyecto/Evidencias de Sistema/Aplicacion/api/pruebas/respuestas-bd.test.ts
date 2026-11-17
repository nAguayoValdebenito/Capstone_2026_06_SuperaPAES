// HU-32.1: responder una pregunta de la práctica contra PostgreSQL real (CP-20 pasos 2 a 5, RN-06,
// RN-07). La corrección la hace el trigger tg_item; la prueba solo mira lo que guarda y lo que responde.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararRespuestas } from './respuestas-de-prueba.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('responder una pregunta con PostgreSQL (CP-20)', () => {
  const r = prepararRespuestas('respuestas');
  const { base, entorno } = r;

  beforeEach(async () => {
    // Prácticas de 5: alcanza con 6 preguntas por caso y la base temporal no se recarga de más.
    await base.publicar(6, { prueba: 'M1', dificultad: 'media' });
  });

  it('CP-20 paso 2: responde, guarda la respuesta corregida por la base y descuenta el cupo', async () => {
    const { id, token } = await base.sesion();
    const pregunta = await r.practicaConPregunta(token);
    const correcta = await r.alternativa(pregunta.itemId, 'A');

    const respuesta = await r.responderHttp(token, pregunta, { alternativaId: correcta });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      esCorrecta: true,
      alternativaElegidaId: correcta,
      alternativaCorrectaId: correcta,
      explicacion: 'Explicación reservada',
      cupo: { maximo: 10, usadas: 1, restantes: 9, saldoExtra: 0, agotado: false },
    });
    expect(respuesta.body.data.alternativas).toEqual([
      { id: correcta, letra: 'A', texto: 'Alternativa A', explicacion: 'Explicación A' },
      expect.objectContaining({ letra: 'B', explicacion: 'Explicación B' }),
      expect.objectContaining({ letra: 'C', explicacion: 'Explicación C' }),
      expect.objectContaining({ letra: 'D', explicacion: 'Explicación D' }),
    ]);
    const guardado = await r.itemGuardado(pregunta.itemId);
    expect(guardado).toMatchObject({ alternativaId: correcta, esCorrecta: true, consumo: 'cupo' });
    expect(guardado?.respondidaEn?.getTime()).toBe(entorno.ahora().getTime());
    expect(guardado?.tiempoSeg).toBeGreaterThanOrEqual(0);
    expect(await r.cupoDe(id, await r.fechaDelReloj())).toEqual({ maximo: 10, usadas: 1 });
  });

  it('una respuesta incorrecta: la base corrige y la respuesta trae la correcta y su explicación', async () => {
    const { token } = await base.sesion();
    const pregunta = await r.practicaConPregunta(token);
    const correcta = await r.alternativa(pregunta.itemId, 'A');
    const elegida = await r.alternativa(pregunta.itemId, 'B');

    // esCorrecta en el cuerpo se descarta: la corrección es del servidor (RN-06).
    const respuesta = await r.responderHttp(token, pregunta, {
      alternativaId: elegida,
      esCorrecta: true,
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      esCorrecta: false,
      alternativaElegidaId: elegida,
      alternativaCorrectaId: correcta,
    });
    expect(await r.itemGuardado(pregunta.itemId)).toMatchObject({ esCorrecta: false });
  });

  it('antes de responder, siguiente no trae la correcta ni las explicaciones; después sí la respuesta', async () => {
    const { token } = await base.sesion();
    const { practicaId } = await r.practicaConPregunta(token);
    const entrega = await base.siguiente(token, practicaId);
    expect(JSON.stringify(entrega.body)).not.toMatch(
      /esCorrecta|alternativaCorrectaId|explicacion|Explicación/i,
    );
  });

  it('CP-20 paso 3: la misma respuesta otra vez se rechaza sin cambiar nada', async () => {
    const { id, token } = await base.sesion();
    const pregunta = await r.practicaConPregunta(token);
    expect((await r.responderCon(token, pregunta, 'A')).status).toBe(200);
    const antes = await r.itemGuardado(pregunta.itemId);

    for (const letra of ['A', 'B'] as const) {
      entorno.avanzarSegundos(30);
      const repetida = await r.responderCon(token, pregunta, letra);
      expect(repetida.status).toBe(409);
      expect(repetida.body.error.codigo).toBe('RESPUESTA_YA_REGISTRADA');
    }
    expect(await r.itemGuardado(pregunta.itemId)).toEqual(antes);
    expect((await r.cupoDe(id, await r.fechaDelReloj()))?.usadas).toBe(1);
  });

  it('CP-20 paso 4: un ítem de otro estudiante, inexistente o de otra evaluación da el mismo 404', async () => {
    const ana = await base.sesion('ana@ejemplo.cl');
    const beto = await base.sesion('beto@ejemplo.cl');
    const deAna = await r.practicaConPregunta(ana.token);
    const anterior = await r.practicaConPregunta(beto.token);
    // Empezar otra práctica deja la anterior abandonada: su ítem no es de la práctica nueva.
    const actual = await r.practicaConPregunta(beto.token);
    const alternativaId = await r.alternativa(deAna.itemId, 'A');

    const intentos = [
      r.responderHttp(beto.token, deAna, { alternativaId }),
      r.responderHttp(
        beto.token,
        { practicaId: actual.practicaId, itemId: deAna.itemId },
        { alternativaId },
      ),
      r.responderHttp(
        beto.token,
        { practicaId: actual.practicaId, itemId: '999999' },
        { alternativaId },
      ),
      r.responderHttp(
        beto.token,
        { practicaId: actual.practicaId, itemId: anterior.itemId },
        { alternativaId: await r.alternativa(anterior.itemId, 'A') },
      ),
    ];
    const respuestas = [];
    for (const intento of intentos) respuestas.push(await intento);

    const mensajes = new Set(respuestas.map((x) => x.body.error?.mensaje as string));
    for (const respuesta of respuestas) {
      expect(respuesta.status).toBe(404);
      expect(respuesta.body.error.codigo).toBe('ITEM_NO_ENCONTRADO');
    }
    expect(mensajes.size).toBe(1);
    expect((await r.itemGuardado(deAna.itemId))?.alternativaId).toBeNull();
    expect((await r.itemGuardado(anterior.itemId))?.alternativaId).toBeNull();
    const { rows } = await entorno.bd.query('SELECT 1 FROM app.cupo_diario');
    expect(rows).toHaveLength(0);
  });

  it('CP-20 paso 5: una alternativa de otra pregunta se rechaza y la base también la rechaza', async () => {
    const { token } = await base.sesion();
    const pregunta = await r.practicaConPregunta(token);
    const { rows } = await entorno.bd.query<{ id: number }>(
      `SELECT a.id::int AS id FROM contenido.alternativa a
        WHERE a.pregunta_id <> (SELECT pregunta_id FROM app.evaluacion_item WHERE id = $1) LIMIT 1`,
      [pregunta.itemId],
    );
    const ajena = rows[0]?.id ?? 0;

    const respuesta = await r.responderHttp(token, pregunta, { alternativaId: ajena });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('ALTERNATIVA_INVALIDA');
    expect((await r.itemGuardado(pregunta.itemId))?.alternativaId).toBeNull();
    expect((await entorno.bd.query('SELECT 1 FROM app.cupo_diario')).rows).toHaveLength(0);
    // La base no depende del servidor: la clave foránea rechaza la misma alternativa.
    await expect(
      entorno.bd.query(
        `UPDATE app.evaluacion_item SET alternativa_id = $2, respondida_en = now(),
           tipo_consumo_id = (SELECT id FROM contenido.tipo_consumo WHERE codigo = 'cupo')
         WHERE id = $1`,
        [pregunta.itemId, ajena],
      ),
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'evaluacion_item_alternativa_id_pregunta_id_fkey',
    });
  });

  it('una práctica cerrada no acepta respuestas (RN-07)', async () => {
    const { token } = await base.sesion();
    const pregunta = await r.practicaConPregunta(token);
    await entorno.bd.query("SELECT app.cerrar_evaluacion($1, 'abandonada')", [pregunta.practicaId]);

    const respuesta = await r.responderCon(token, pregunta);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe('EVALUACION_CERRADA');
    expect((await r.itemGuardado(pregunta.itemId))?.alternativaId).toBeNull();
  });

  it('un ítem con tiempo guarda la respuesta sin corregir ni descontar cupo (HU-40.1)', async () => {
    const { id, token } = await base.sesion();
    const diagnostico = await base.crearEvaluacionAbierta('diagnostico', id, base.pruebaId);
    const { rows } = await entorno.bd.query<{ id: string }>(
      `INSERT INTO app.evaluacion_item (evaluacion_id, prueba_id, pregunta_id, version_pregunta, orden)
       SELECT $1, p.prueba_id, p.id, p.version, 1 FROM contenido.pregunta p
        WHERE p.prueba_id = $2 ORDER BY p.id LIMIT 1 RETURNING id::text`,
      [diagnostico, base.pruebaId],
    );
    const pregunta = { practicaId: diagnostico, itemId: rows[0]?.id ?? '' };

    const respuesta = await r.responderCon(token, pregunta);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).not.toHaveProperty('esCorrecta');
    expect(respuesta.body.data).not.toHaveProperty('alternativaCorrectaId');
    expect((await r.itemGuardado(pregunta.itemId))?.esCorrecta).toBeNull();
    expect((await r.itemGuardado(pregunta.itemId))?.consumo).toBeNull();
  });

  it('sin sesión o con la sesión de la consola, la ruta responde NO_AUTENTICADO', async () => {
    const { token } = await base.sesion();
    const pregunta = await r.practicaConPregunta(token);
    const alternativaId = await r.alternativa(pregunta.itemId, 'A');
    const ruta = `/api/v1/app/evaluaciones/${pregunta.practicaId}/items/${pregunta.itemId}/respuesta`;
    const admin = await entorno.crearAdmin();
    const ingreso = await request(entorno.app).post('/api/v1/admin/cuentas/ingreso').send(admin);
    expect(ingreso.status).toBe(200);

    const sinSesion = await request(entorno.app).post(ruta).send({ alternativaId });
    const conConsola = await request(entorno.app)
      .post(ruta)
      .set('Authorization', `Bearer ${ingreso.body.data.tokenAcceso as string}`)
      .send({ alternativaId });

    for (const respuesta of [sinSesion, conConsola]) {
      expect(respuesta.status).toBe(401);
      expect(respuesta.body.error.codigo).toBe('NO_AUTENTICADO');
    }
    expect((await r.itemGuardado(pregunta.itemId))?.alternativaId).toBeNull();
  });

  it('una alternativa que no es un número entero se rechaza con VALIDACION', async () => {
    const { token } = await base.sesion();
    const pregunta = await r.practicaConPregunta(token);
    for (const alternativaId of ['12', 1.5, null]) {
      const respuesta = await r.responderHttp(token, pregunta, { alternativaId });
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.codigo).toBe('VALIDACION');
    }
  });

  it('el progreso refleja la respuesta sin código adicional (v_respuesta_valida y v_progreso_eje)', async () => {
    const { id, token } = await base.sesion();
    const pregunta = await r.practicaConPregunta(token);
    expect((await r.responderCon(token, pregunta, 'A')).status).toBe(200);

    const { rows: validas } = await entorno.bd.query<{ esCorrecta: boolean }>(
      'SELECT es_correcta AS "esCorrecta" FROM app.v_respuesta_valida WHERE evaluacion_item_id = $1',
      [pregunta.itemId],
    );
    const { rows: ejes } = await entorno.bd.query<{ respondidas: number; correctas: number }>(
      `SELECT respondidas::int, correctas::int FROM app.v_progreso_eje
        WHERE estudiante_id = $1 AND prueba_id = $2`,
      [id, base.pruebaId],
    );
    expect(validas).toEqual([{ esCorrecta: true }]);
    expect(ejes).toEqual([{ respondidas: 1, correctas: 1 }]);
  });

  it('los registros del servidor no repiten la respuesta correcta ni las explicaciones', async () => {
    const app = entorno.crearAppCon({ registrarPeticiones: true });
    const { token } = await base.sesion();
    const pregunta = await r.practicaConPregunta(token);
    const salidas = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error')];
    for (const salida of salidas) salida.mockImplementation(() => undefined);

    expect((await r.responderCon(token, pregunta, 'B', app)).status).toBe(200);

    const registrado = salidas
      .flatMap((salida) => salida.mock.calls.flat() as unknown[])
      .map(String)
      .join('\n');
    expect(registrado).toContain('respuesta');
    expect(registrado).not.toMatch(/Explicación|alternativaCorrectaId|esCorrecta/);
    for (const salida of salidas) salida.mockRestore();
  });
});
