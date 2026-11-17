// HU-35.1: cupo del día, preguntas extra, próximo reinicio y racha para el inicio de la app (A12),
// contra PostgreSQL real (RF-A05, RN-01, RN-02, CP-22 paso 1 y 4). Las horas y fechas de Chile están
// escritas a mano, no calculadas con la misma fórmula del código.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararRespuestas } from './respuestas-de-prueba.js';

const RUTA = '/api/v1/app/cupo-invitaciones/cupo';
/** Miércoles 28 de octubre de 2026 a las 12:00 de Chile (horario de verano, UTC-3). */
const MEDIODIA = new Date('2026-10-28T15:00:00Z');

exigirBaseEnCi();
describe.skipIf(!urlBase)('inicio: cupo del día y racha con PostgreSQL (HU-35.1)', () => {
  const r = prepararRespuestas('inicio');
  const { base, entorno } = r;

  const consultar = (token: string) =>
    request(entorno.app).get(RUTA).set('Authorization', `Bearer ${token}`);

  /** Estudiante con sesión abierta a la hora dada (por defecto, el mediodía del 28/10). */
  async function estudianteA(hora = MEDIODIA) {
    const { id } = await base.sesion();
    return { id, token: await r.irA(hora) };
  }

  async function fijarRacha(id: string, dias: number, ultimoDia: string | null) {
    await entorno.bd.query(
      'UPDATE app.estudiante SET racha_dias = $2, ultimo_dia_practica = $3::date WHERE id = $1',
      [id, dias, ultimoDia],
    );
  }

  it('sin respuestas hoy muestra el cupo completo de 10 y no crea la fila del día', async () => {
    const { id, token } = await estudianteA();

    const respuesta = await consultar(token);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      data: {
        maximo: 10,
        usadas: 0,
        restantes: 10,
        saldoExtra: 0,
        reiniciaEn: '2026-10-29T03:00:00.000Z',
        racha: 0,
      },
      error: null,
      meta: null,
    });
    expect(await r.cupoDe(id, '2026-10-28')).toBeNull();
  });

  it('con el correo verificado y sin fila del día, el máximo es 20 (RN-01)', async () => {
    const { id, token } = await estudianteA();
    await entorno.bd.query(
      'UPDATE app.estudiante SET correo_verificado = true, verificado_en = now() WHERE id = $1',
      [id],
    );

    const respuesta = await consultar(token);

    expect(respuesta.body.data).toMatchObject({ maximo: 20, usadas: 0, restantes: 20 });
  });

  it('muestra las usadas de hoy y el saldo de preguntas extra (esc. 1)', async () => {
    const { id, token } = await estudianteA();
    await r.fijarCupo(id, '2026-10-28', 20, 7);
    await r.fijarCupo(id, '2026-10-27', 20, 20); // el día anterior no cuenta
    await r.darSaldoExtra(id, 5);

    const respuesta = await consultar(token);

    expect(respuesta.body.data).toMatchObject({
      maximo: 20,
      usadas: 7,
      restantes: 13,
      saldoExtra: 5,
    });
  });

  it('con el cupo agotado muestra 0 restantes y el saldo que queda', async () => {
    const { id, token } = await estudianteA();
    await r.fijarCupo(id, '2026-10-28', 10, 10);
    await r.darSaldoExtra(id, 2);

    const respuesta = await consultar(token);

    expect(respuesta.body.data).toMatchObject({ usadas: 10, restantes: 0, saldoExtra: 2 });
  });

  // Racha (esc. 2, glosario del DAS): mientras no responda hoy se muestra la de ayer; si pasó un día
  // completo sin responder, es 0.
  it.each([
    { caso: 'respondió hoy', ultimoDia: '2026-10-28', esperada: 4 },
    { caso: 'respondió ayer y todavía no hoy', ultimoDia: '2026-10-27', esperada: 4 },
    { caso: 'pasó un día completo sin responder', ultimoDia: '2026-10-26', esperada: 0 },
    { caso: 'nunca respondió', ultimoDia: null, esperada: 0 },
  ])('racha cuando $caso: $esperada', async ({ ultimoDia, esperada }) => {
    const { id, token } = await estudianteA();
    await fijarRacha(id, ultimoDia ? 4 : 0, ultimoDia);

    const respuesta = await consultar(token);

    expect(respuesta.body.data.racha).toBe(esperada);
  });

  it('la racha cambia de día a las 00:00 de Chile, no de UTC', async () => {
    // 28/10 a las 23:30 de Chile ya es 29/10 en UTC: el último día con respuestas (27/10) sigue
    // siendo ayer.
    const { id, token } = await estudianteA(new Date('2026-10-29T02:30:00Z'));
    await fijarRacha(id, 3, '2026-10-27');

    expect((await consultar(token)).body.data.racha).toBe(3);

    // 29/10 a las 00:00 de Chile. Se vuelve a ingresar: el token de 15 minutos venció con ese reloj.
    const tokenMedianoche = await r.irA(new Date('2026-10-29T03:00:00Z'));
    expect((await consultar(tokenMedianoche)).body.data.racha).toBe(0);
  });

  it('CP-22 pasos 1 y 4: practicó ayer, responde hoy y el inicio muestra 2 días y una pregunta menos', async () => {
    // Una práctica de 5 necesita al menos 5 preguntas publicadas.
    await base.publicar(6, { prueba: 'M1', dificultad: 'media' });
    const { id, token } = await estudianteA();
    await fijarRacha(id, 1, '2026-10-27');
    expect((await consultar(token)).body.data).toMatchObject({ restantes: 10, racha: 1 });

    const respondida = await r.responderCon(token, await r.practicaConPregunta(token));
    expect(respondida.status).toBe(200);

    expect((await consultar(token)).body.data).toMatchObject({
      usadas: 1,
      restantes: 9,
      saldoExtra: 0,
      racha: 2,
    });
  });

  // Próximo reinicio (RN-02). El 4 de abril de 2026 la hora 23:00 se repite (vuelve el horario de
  // invierno) y el 6 de septiembre no hay 00:00: el día empieza a la 01:00.
  it.each([
    {
      caso: 'un día de horario de verano',
      ahora: '2026-10-24T20:00:00Z',
      reinicio: '2026-10-25T03:00:00.000Z',
    },
    {
      caso: 'un día de horario de invierno',
      ahora: '2026-07-15T16:00:00Z',
      reinicio: '2026-07-16T04:00:00.000Z',
    },
    {
      caso: 'el 4 de abril, a las 22:00 (antes de que se repita la hora 23)',
      ahora: '2026-04-05T01:00:00Z',
      reinicio: '2026-04-05T04:00:00.000Z',
    },
    {
      caso: 'el 5 de septiembre, a las 20:00 (el 6 empieza a la 01:00)',
      ahora: '2026-09-06T00:00:00Z',
      reinicio: '2026-09-06T04:00:00.000Z',
    },
    {
      caso: 'el último segundo del día',
      ahora: '2026-10-29T02:59:59Z',
      reinicio: '2026-10-29T03:00:00.000Z',
    },
    {
      caso: 'el primer segundo del día',
      ahora: '2026-10-29T03:00:00Z',
      reinicio: '2026-10-30T03:00:00.000Z',
    },
  ])('reinicia a las 00:00 de Chile en $caso', async ({ ahora, reinicio }) => {
    const { token } = await estudianteA(new Date(ahora));

    const respuesta = await consultar(token);

    expect(respuesta.body.data.reiniciaEn).toBe(reinicio);
  });

  it('el día del cupo es el de Chile: a las 23:30 del 28/10 cuenta la fila del 28/10', async () => {
    const { id, token } = await estudianteA(new Date('2026-10-29T02:30:00Z'));
    await r.fijarCupo(id, '2026-10-28', 10, 6);

    expect((await consultar(token)).body.data).toMatchObject({ usadas: 6, restantes: 4 });
  });

  it('sin la sesión de la app responde 401', async () => {
    expect((await request(entorno.app).get(RUTA)).status).toBe(401);
  });
});
