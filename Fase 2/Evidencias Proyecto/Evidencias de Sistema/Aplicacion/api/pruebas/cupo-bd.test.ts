// HU-32.3: pruebas del cupo contra PostgreSQL real (CP-21, RN-01, RN-02, RN-04). Las fechas de Chile
// de los casos de borde están escritas a mano, no calculadas con la misma fórmula del código.
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';
import { prepararRespuestas } from './respuestas-de-prueba.js';

/** Instante de las 00:00 de Chile del día siguiente al de la hora dada, según la base. */
const MEDIANOCHE_SIGUIENTE = `SELECT ((($1::timestamptz AT TIME ZONE 'America/Santiago')::date + 1)::timestamp
  AT TIME ZONE 'America/Santiago') AS instante`;

exigirBaseEnCi();
describe.skipIf(!urlBase)('cupo diario y preguntas extra con PostgreSQL (CP-21)', () => {
  const r = prepararRespuestas('cupo');
  const { base, entorno } = r;

  beforeEach(async () => {
    // Prácticas de 5: alcanza con 6 preguntas por caso. CP-21 agrega las que le faltan para dos de 20.
    await base.publicar(6, { prueba: 'M1', dificultad: 'media' });
  });

  /** Responde la pregunta pendiente de la práctica y pide la siguiente si quedan. */
  async function responderSeguidas(token: string, cuantas: number) {
    const consumos: string[] = [];
    let pregunta = await r.practicaConPregunta(token, 20);
    for (let n = 1; n <= cuantas; n++) {
      // B: incorrecta, así la pregunta sigue disponible para otra práctica (RF-A07).
      const respuesta = await r.responderCon(token, pregunta, 'B');
      expect(respuesta.status, `respuesta ${String(n)}`).toBe(200);
      consumos.push((await r.itemGuardado(pregunta.itemId))?.consumo ?? '');
      if (n === cuantas) break;
      pregunta =
        n % 20 === 0
          ? await r.practicaConPregunta(token, 20)
          : { ...pregunta, itemId: await r.entregar(token, pregunta.practicaId) };
    }
    return { consumos, pregunta };
  }

  it(
    'CP-21: 20 del cupo del día, 5 del saldo, la siguiente se rechaza y a las 00:00 vuelve a 20',
    async () => {
      // Las respuestas son incorrectas: las mismas 20 preguntas sirven otra vez en la segunda práctica.
      await base.publicar(14, { prueba: 'M1', dificultad: 'media' });
      const { id, token } = await base.sesion();
      await entorno.bd.query(
        'UPDATE app.estudiante SET correo_verificado = true, verificado_en = now() WHERE id = $1',
        [id],
      );
      await r.darSaldoExtra(id, 5);
      const hoy = await r.fechaDelReloj();

      const { consumos, pregunta } = await responderSeguidas(token, 25);

      expect(consumos.slice(0, 20)).toEqual(Array<string>(20).fill('cupo'));
      expect(consumos.slice(20)).toEqual(Array<string>(5).fill('bono'));
      expect(await r.cupoDe(id, hoy)).toEqual({ maximo: 20, usadas: 20 });
      expect(await r.saldoExtra(id)).toBe(0);
      const { rows: movimientos } = await entorno.bd.query(
        `SELECT 1 FROM app.movimiento_bono m JOIN contenido.tipo_movimiento_bono t ON t.id = m.tipo_movimiento_bono_id
          WHERE m.estudiante_id = $1 AND t.codigo = 'consumo' AND m.evaluacion_item_id IS NOT NULL AND m.cantidad = 1`,
        [id],
      );
      expect(movimientos).toHaveLength(5);

      // La 26: nada que descontar. No se guarda nada. La entrega también se niega (HU-33 esc. 1).
      const siguiente = await base.siguiente(token, pregunta.practicaId);
      expect(siguiente.status).toBe(409);
      expect(siguiente.body.error).toMatchObject({
        codigo: 'CUPO_AGOTADO',
        detalles: { maximo: 20, usadas: 20, restantes: 0, saldoExtra: 0, agotado: true },
      });

      const { rows } = await entorno.bd.query<{ instante: Date }>(MEDIANOCHE_SIGUIENTE, [
        entorno.ahora(),
      ]);
      const tokenManana = await r.irA(rows[0]?.instante ?? new Date());
      const manana = await r.fechaDelReloj();
      const nueva = await r.responderCon(
        tokenManana,
        {
          practicaId: pregunta.practicaId,
          itemId: await r.entregar(tokenManana, pregunta.practicaId),
        },
        'B',
      );
      expect(nueva.status).toBe(200);
      expect(nueva.body.data.cupo).toEqual({
        maximo: 20,
        usadas: 1,
        restantes: 19,
        saldoExtra: 0,
        agotado: false,
      });
      expect(await r.cupoDe(id, manana)).toEqual({ maximo: 20, usadas: 1 });
      expect(await r.cupoDe(id, hoy)).toEqual({ maximo: 20, usadas: 20 });
    },
    MINUTO,
  );

  it('la respuesta que no encuentra nada que descontar se rechaza sin guardar nada', async () => {
    const { id, token } = await base.sesion();
    const pregunta = await r.practicaConPregunta(token);
    const hoy = await r.fechaDelReloj();
    await r.fijarCupo(id, hoy, 10, 10);

    const respuesta = await r.responderCon(token, pregunta);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toMatchObject({
      codigo: 'CUPO_AGOTADO',
      detalles: { maximo: 10, usadas: 10, restantes: 0, saldoExtra: 0, agotado: true },
    });
    expect(await r.itemGuardado(pregunta.itemId)).toMatchObject({
      alternativaId: null,
      consumo: null,
    });
    expect(await r.cupoDe(id, hoy)).toEqual({ maximo: 10, usadas: 10 });
  });

  it('el saldo de preguntas extra que no se usó no se pierde al cambiar el día', async () => {
    const { id, token } = await base.sesion();
    await r.darSaldoExtra(id, 5);
    await r.fijarCupo(id, await r.fechaDelReloj(), 10, 10);
    const pregunta = await r.practicaConPregunta(token);
    const { rows } = await entorno.bd.query<{ instante: Date }>(MEDIANOCHE_SIGUIENTE, [
      entorno.ahora(),
    ]);
    const tokenManana = await r.irA(rows[0]?.instante ?? new Date());

    const respuesta = await r.responderCon(tokenManana, pregunta);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.cupo).toMatchObject({ maximo: 10, usadas: 1, saldoExtra: 5 });
    expect((await r.itemGuardado(pregunta.itemId))?.consumo).toBe('cupo');
  });

  // Último segundo de un día y primero del siguiente, en hora de Chile. El 4 de abril de 2026 la hora
  // 23:00 se repite (vuelve el horario de invierno) y el 6 de septiembre el día empieza a la 01:00.
  it.each([
    {
      caso: 'un día cualquiera',
      antes: '2026-10-25T02:59:59Z',
      diaAntes: '2026-10-24',
      despues: '2026-10-25T03:00:00Z',
      diaDespues: '2026-10-25',
    },
    {
      caso: 'el 4 de abril (se repite la hora 23)',
      antes: '2026-04-05T03:59:59Z',
      diaAntes: '2026-04-04',
      despues: '2026-04-05T04:00:00Z',
      diaDespues: '2026-04-05',
    },
    {
      caso: 'el 6 de septiembre (de 00:00 a 01:00)',
      antes: '2026-09-06T03:59:59Z',
      diaAntes: '2026-09-05',
      despues: '2026-09-06T04:00:00Z',
      diaDespues: '2026-09-06',
    },
  ])('reinicio a las 00:00 de Chile en $caso', async ({ antes, diaAntes, despues, diaDespues }) => {
    const { id } = await base.sesion();
    await r.fijarCupo(id, diaAntes, 10, 10);
    const token = await r.irA(new Date(despues));
    const pregunta = await r.practicaConPregunta(token);

    entorno.fijarHora(new Date(antes));
    const agotada = await r.responderCon(token, pregunta);
    entorno.fijarHora(new Date(despues));
    const nueva = await r.responderCon(token, pregunta);

    expect(agotada.status).toBe(409);
    expect(agotada.body.error.codigo).toBe('CUPO_AGOTADO');
    expect(nueva.status).toBe(200);
    expect(await r.cupoDe(id, diaAntes)).toEqual({ maximo: 10, usadas: 10 });
    expect(await r.cupoDe(id, diaDespues)).toEqual({ maximo: 10, usadas: 1 });
  });

  it('sin verificar el máximo es 10 y verificado es 20, leídos de la configuración', async () => {
    const sinVerificar = await base.sesion('sin@ejemplo.cl');
    const verificado = await base.sesion('con@ejemplo.cl');
    await entorno.bd.query(
      'UPDATE app.estudiante SET correo_verificado = true, verificado_en = now() WHERE id = $1',
      [verificado.id],
    );

    const primera = await r.responderCon(
      sinVerificar.token,
      await r.practicaConPregunta(sinVerificar.token),
    );
    const segunda = await r.responderCon(
      verificado.token,
      await r.practicaConPregunta(verificado.token),
    );

    expect(primera.body.data.cupo).toMatchObject({ maximo: 10, usadas: 1, restantes: 9 });
    expect(segunda.body.data.cupo).toMatchObject({ maximo: 20, usadas: 1, restantes: 19 });
    // El máximo sale de contenido.configuracion, no del código.
    await entorno.bd.query(
      "UPDATE contenido.configuracion SET valor = '12'::jsonb WHERE clave = 'cupo_inicial'",
    );
    try {
      const otro = await base.sesion('otro@ejemplo.cl');
      const tercera = await r.responderCon(otro.token, await r.practicaConPregunta(otro.token));
      expect(tercera.body.data.cupo).toMatchObject({ maximo: 12, usadas: 1 });
    } finally {
      await entorno.bd.query(
        "UPDATE contenido.configuracion SET valor = '10'::jsonb WHERE clave = 'cupo_inicial'",
      );
    }
  });

  it('verificar el correo a mitad del día sube el máximo a 20 sin borrar lo usado (RN-01)', async () => {
    const { id, token } = await base.sesion();
    let pregunta = await r.practicaConPregunta(token);
    for (let n = 0; n < 2; n++) {
      expect((await r.responderCon(token, pregunta, 'B')).status).toBe(200);
      pregunta = { ...pregunta, itemId: await r.entregar(token, pregunta.practicaId) };
    }
    const hoy = await r.fechaDelReloj();
    expect(await r.cupoDe(id, hoy)).toEqual({ maximo: 10, usadas: 2 });
    const admin = await entorno.crearAdmin();
    const ingreso = await request(entorno.app).post('/api/v1/admin/cuentas/ingreso').send(admin);
    const confirmacion = await request(entorno.app)
      .post(`/api/v1/admin/cuentas/estudiantes/${id}/confirmar-correo`)
      .set('Authorization', `Bearer ${ingreso.body.data.tokenAcceso as string}`);
    expect(confirmacion.status).toBe(200);
    expect(await r.cupoDe(id, hoy)).toEqual({ maximo: 20, usadas: 2 });

    const respuesta = await r.responderCon(token, pregunta, 'B');

    expect(respuesta.body.data.cupo).toMatchObject({ maximo: 20, usadas: 3, restantes: 17 });
  });

  it('con una suscripción que cubre la prueba no se descuenta cupo ni saldo (RN-04)', async () => {
    const conSuscripcion = entorno.crearAppCon({ cubrePrueba: () => Promise.resolve(true) });
    const { id, token } = await base.sesion();
    await r.darSaldoExtra(id, 2);
    const hoy = await r.fechaDelReloj();
    await r.fijarCupo(id, hoy, 10, 10);
    const pregunta = await r.practicaConPregunta(token);

    const respuesta = await r.responderCon(token, pregunta, 'A', conSuscripcion);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.cupo).toEqual({
      maximo: 10,
      usadas: 10,
      restantes: 0,
      saldoExtra: 2,
      agotado: false,
    });
    expect((await r.itemGuardado(pregunta.itemId))?.consumo).toBe('suscripcion');
    expect(await r.cupoDe(id, hoy)).toEqual({ maximo: 10, usadas: 10 });
    expect(await r.saldoExtra(id)).toBe(2);
  });
});
