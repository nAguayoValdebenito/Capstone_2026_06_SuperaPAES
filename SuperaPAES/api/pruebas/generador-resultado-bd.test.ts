// Los topes de C05 contra PostgreSQL real (RNF-03): lo usado hoy y en el mes, y sus máximos.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararGenerador } from './generador-bd.js';

const RUTA_USO = '/api/v1/admin/generador/uso';

exigirBaseEnCi();
describe.skipIf(!urlBase)('consultas del generador con PostgreSQL (C05)', () => {
  const g = prepararGenerador('resultado');

  it('informa lo usado de los topes: cuenta lo pedido y sus máximos', async () => {
    const sesion = await g.sesionAdmin();
    const antes = await request(g.app).get(RUTA_USO).set(sesion);
    await g.pedirLote(sesion, { contenidoId: g.contenidos.m2, cantidad: 3 });

    const despues = await request(g.app).get(RUTA_USO).set(sesion);

    expect(despues.status).toBe(200);
    expect(despues.body.data.hoy.maximo).toBe(100);
    expect(despues.body.data.mes.maximoUsd).toBe(10);
    expect(despues.body.data.hoy.usadas).toBe(antes.body.data.hoy.usadas + 3);
  });

  it('un docente no ve los topes', async () => {
    const docente = await g.sesionDocente(await g.sesionAdmin());

    const respuesta = await request(g.app).get(RUTA_USO).set(docente);

    expect(respuesta.status).toBe(403);
  });
});
