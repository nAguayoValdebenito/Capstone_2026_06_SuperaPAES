// HU-32.1 y HU-32.3: todo o nada, concurrencia y cupo agotado al responder, contra PostgreSQL real.
// Los fallos forzados usan disparadores que solo existen en esta base temporal y se borran al final.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararRespuestas, type PreguntaEntregada } from './respuestas-de-prueba.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('responder: todo o nada, concurrencia y cupo agotado', () => {
  const r = prepararRespuestas('respuestas_limites');
  const { base, entorno } = r;

  beforeEach(async () => {
    await base.publicar(6, { prueba: 'M1', dificultad: 'media' });
  });

  afterEach(async () => {
    await entorno.bd.query(`
      DROP TRIGGER IF EXISTS prueba_falla_item ON app.evaluacion_item;
      DROP TRIGGER IF EXISTS prueba_falla_movimiento ON app.movimiento_bono;
      DROP FUNCTION IF EXISTS pg_temp.prueba_fallar();
      DROP FUNCTION IF EXISTS public.prueba_fallar();`);
    vi.restoreAllMocks();
  });

  /** Disparador que falla siempre, para simular un error a mitad de la transacción. */
  async function forzarFalla(tabla: 'app.evaluacion_item' | 'app.movimiento_bono') {
    const nombre =
      tabla === 'app.evaluacion_item' ? 'prueba_falla_item' : 'prueba_falla_movimiento';
    const momento = tabla === 'app.evaluacion_item' ? 'BEFORE UPDATE' : 'BEFORE INSERT';
    await entorno.bd.query(`
      CREATE OR REPLACE FUNCTION public.prueba_fallar() RETURNS trigger LANGUAGE plpgsql AS
        $$ BEGIN RAISE EXCEPTION 'falla forzada por la prueba'; END $$;
      CREATE TRIGGER ${nombre} ${momento} ON ${tabla}
        FOR EACH ROW EXECUTE FUNCTION public.prueba_fallar();`);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  }

  /** Un segundo ítem pendiente en la misma práctica, puesto directo en la base de prueba. */
  async function otroItemPendiente(pregunta: PreguntaEntregada): Promise<PreguntaEntregada> {
    const { rows } = await entorno.bd.query<{ id: string }>(
      `INSERT INTO app.evaluacion_item (evaluacion_id, prueba_id, pregunta_id, version_pregunta, orden)
       SELECT $1, p.prueba_id, p.id, p.version, 2 FROM contenido.pregunta p
        WHERE p.prueba_id = $2 AND p.id NOT IN (SELECT pregunta_id FROM app.evaluacion_item WHERE evaluacion_id = $1)
        ORDER BY p.id LIMIT 1 RETURNING id::text`,
      [pregunta.practicaId, base.pruebaId],
    );
    return { practicaId: pregunta.practicaId, itemId: rows[0]?.id ?? '' };
  }

  it('si falla el guardado después de descontar el cupo, el cupo vuelve a su valor y no queda la respuesta', async () => {
    const { id, token } = await base.sesion();
    const pregunta = await r.practicaConPregunta(token);
    const hoy = await r.fechaDelReloj();
    await r.fijarCupo(id, hoy, 10, 3);
    await forzarFalla('app.evaluacion_item');

    const respuesta = await r.responderCon(token, pregunta);

    expect(respuesta.status).toBe(500);
    expect(await r.cupoDe(id, hoy)).toEqual({ maximo: 10, usadas: 3 });
    expect(await r.itemGuardado(pregunta.itemId)).toMatchObject({
      alternativaId: null,
      consumo: null,
    });
  });

  it('si falla el movimiento de la pregunta extra, tampoco queda la respuesta guardada', async () => {
    const { id, token } = await base.sesion();
    const pregunta = await r.practicaConPregunta(token);
    const hoy = await r.fechaDelReloj();
    await r.fijarCupo(id, hoy, 10, 10);
    await r.darSaldoExtra(id, 1);
    await forzarFalla('app.movimiento_bono');

    const respuesta = await r.responderCon(token, pregunta);

    expect(respuesta.status).toBe(500);
    expect(await r.itemGuardado(pregunta.itemId)).toMatchObject({
      alternativaId: null,
      consumo: null,
    });
    expect(await r.saldoExtra(id)).toBe(1);
    expect(await r.cupoDe(id, hoy)).toEqual({ maximo: 10, usadas: 10 });
  });

  it('dos respuestas a la vez al mismo ítem: una se acepta y la otra se rechaza', async () => {
    const { id, token } = await base.sesion();
    const pregunta = await r.practicaConPregunta(token);
    const [a, b] = await Promise.all([
      r.responderCon(token, pregunta, 'A'),
      r.responderCon(token, pregunta, 'B'),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect([a, b].find((x) => x.status === 409)?.body.error.codigo).toBe('RESPUESTA_YA_REGISTRADA');
    expect((await r.cupoDe(id, await r.fechaDelReloj()))?.usadas).toBe(1);
  });

  it('dos ítems a la vez con un solo cupo restante: uno se acepta y el otro da CUPO_AGOTADO', async () => {
    const { id, token } = await base.sesion();
    const primera = await r.practicaConPregunta(token);
    const segunda = await otroItemPendiente(primera);
    const hoy = await r.fechaDelReloj();
    await r.fijarCupo(id, hoy, 10, 9);

    const respuestas = await Promise.all([
      r.responderCon(token, primera),
      r.responderCon(token, segunda),
    ]);

    expect(respuestas.map((x) => x.status).sort()).toEqual([200, 409]);
    expect(respuestas.find((x) => x.status === 409)?.body.error.codigo).toBe('CUPO_AGOTADO');
    expect(await r.cupoDe(id, hoy)).toEqual({ maximo: 10, usadas: 10 });
    expect(await r.saldoExtra(id)).toBe(0);
  });

  it('dos ítems a la vez con una sola pregunta extra: el saldo nunca queda negativo', async () => {
    const { id, token } = await base.sesion();
    const primera = await r.practicaConPregunta(token);
    const segunda = await otroItemPendiente(primera);
    await r.fijarCupo(id, await r.fechaDelReloj(), 10, 10);
    await r.darSaldoExtra(id, 1);

    const respuestas = await Promise.all([
      r.responderCon(token, primera),
      r.responderCon(token, segunda),
    ]);

    expect(respuestas.map((x) => x.status).sort()).toEqual([200, 409]);
    expect(respuestas.find((x) => x.status === 409)?.body.error.codigo).toBe('CUPO_AGOTADO');
    expect(await r.saldoExtra(id)).toBe(0);
  });

  it('la respuesta que gasta lo último se acepta con agotado, y después no se entrega ni se inicia nada', async () => {
    const { id, token } = await base.sesion();
    const pregunta = await r.practicaConPregunta(token);
    await r.fijarCupo(id, await r.fechaDelReloj(), 10, 9);

    const ultima = await r.responderCon(token, pregunta);

    expect(ultima.status).toBe(200);
    expect(ultima.body.data.cupo).toEqual({
      maximo: 10,
      usadas: 10,
      restantes: 0,
      saldoExtra: 0,
      agotado: true,
    });
    const siguiente = await base.siguiente(token, pregunta.practicaId);
    const inicio = await base.inicio(token, { pruebaId: base.pruebaId, cantidad: 5 });
    for (const respuesta of [siguiente, inicio]) {
      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error).toMatchObject({
        codigo: 'CUPO_AGOTADO',
        detalles: { maximo: 10, usadas: 10, restantes: 0, saldoExtra: 0, agotado: true },
      });
    }
    // Sin cupo no se cierra la práctica abierta ni se crea otra.
    const { rows } = await entorno.bd.query<{ id: string }>(
      'SELECT id::text FROM app.evaluacion WHERE estudiante_id = $1 AND cerrada_en IS NULL',
      [id],
    );
    expect(rows).toEqual([{ id: pregunta.practicaId }]);
  });

  it('con preguntas extra se puede seguir: siguiente entrega aunque el cupo del día se agotó', async () => {
    const { id, token } = await base.sesion();
    const pregunta = await r.practicaConPregunta(token);
    await r.fijarCupo(id, await r.fechaDelReloj(), 10, 9);
    await r.darSaldoExtra(id, 1);

    expect((await r.responderCon(token, pregunta)).body.data.cupo).toMatchObject({
      agotado: false,
    });
    expect((await base.siguiente(token, pregunta.practicaId)).status).toBe(200);
  });
});
