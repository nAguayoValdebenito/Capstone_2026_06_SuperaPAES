// HU-45.2 (RF-A13, CU-12 1.a, A44), contra PostgreSQL real: la suscripción activa o en mora del estudiante
// de la sesión, con la dirección para gestionarla en su tienda. Nunca el token de compra.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararPracticas } from './base-practicas.js';
import { RUTA_SUSCRIPCIONES } from './compras-de-prueba.js';
import { insertarSuscripcion } from './suscripciones-de-prueba.js';

const RUTA = `${RUTA_SUSCRIPCIONES}/actual`;
const FIN = new Date('2027-03-01T15:00:00.000Z');

exigirBaseEnCi();
describe.skipIf(!urlBase)('suscripción actual con PostgreSQL (HU-45.2)', () => {
  const base = prepararPracticas('actual');
  const { entorno } = base;
  const consultar = (token: string) =>
    request(entorno.crearAppCon({ paqueteGooglePlay: 'cl.superapaes.app' }))
      .get(RUTA)
      .set('Authorization', `Bearer ${token}`);

  it('sin una suscripción activa o en mora responde vacío', async () => {
    const { id, token } = await base.sesion('sin-plan@ejemplo.cl');
    await insertarSuscripcion(entorno.bd, {
      estudianteId: id,
      plan: 'Una prueba anual',
      estado: 'vencida',
    });

    const respuesta = await consultar(token);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toBeNull();
  });

  it('entrega el plan, la renovación y el enlace al producto en Google Play', async () => {
    const { id, token } = await base.sesion('anual@ejemplo.cl');
    await insertarSuscripcion(entorno.bd, {
      estudianteId: id,
      plan: 'Todas las pruebas anual',
      estado: 'activa',
      periodoFin: FIN,
    });

    expect((await consultar(token)).body.data).toEqual({
      estado: 'activa',
      plan: 'Todas las pruebas',
      alcance: 'todas',
      pruebasIncluidas: [],
      coberturaVigente: true,
      periodicidad: 'anual',
      tienda: 'google_play',
      periodoFin: FIN.toISOString(),
      renuevaAutomaticamente: true,
      gestionUrl:
        'https://play.google.com/store/account/subscriptions?sku=todas_anual&package=cl.superapaes.app',
    });
  });

  it('una en mora de la App Store abre la lista de suscripciones de Apple', async () => {
    const { id, token } = await base.sesion('mora@ejemplo.cl');
    await insertarSuscripcion(entorno.bd, {
      estudianteId: id,
      plan: 'Una prueba mensual',
      estado: 'en_mora',
      tienda: 'app_store',
    });

    expect((await consultar(token)).body.data).toMatchObject({
      estado: 'en_mora',
      periodoFin: null,
      gestionUrl: 'https://apps.apple.com/account/subscriptions',
    });
  });

  it('una activa que canceló sigue vigente, pero ya no se renueva (CU-12 1.a)', async () => {
    const { id, token } = await base.sesion('cancelo@ejemplo.cl');
    await insertarSuscripcion(entorno.bd, {
      estudianteId: id,
      plan: 'Todas las pruebas anual',
      estado: 'activa',
      periodoFin: FIN,
      canceladaEn: entorno.ahora(),
    });

    expect((await consultar(token)).body.data).toMatchObject({
      estado: 'activa',
      renuevaAutomaticamente: false,
    });
  });

  it('solo entrega la suscripción de la sesión, sin datos de la compra', async () => {
    const ana = await base.sesion('ana@ejemplo.cl');
    const beto = await base.sesion('beto@ejemplo.cl');
    await insertarSuscripcion(entorno.bd, {
      estudianteId: ana.id,
      plan: 'Una prueba anual',
      estado: 'activa',
    });

    const deAna = await consultar(ana.token);

    expect((await consultar(beto.token)).body.data).toBeNull();
    expect(Object.keys(deAna.body.data as object).sort()).toEqual([
      'alcance',
      'coberturaVigente',
      'estado',
      'gestionUrl',
      'periodicidad',
      'periodoFin',
      'plan',
      'pruebasIncluidas',
      'renuevaAutomaticamente',
      'tienda',
    ]);
  });

  it('sin sesión responde 401', async () => {
    expect((await request(entorno.app).get(RUTA)).status).toBe(401);
  });

  it('F3: entrega la prueba incluida sin extender la cobertura a otras', async () => {
    const { id, token } = await base.sesion('incluida@ejemplo.cl');
    await insertarSuscripcion(entorno.bd, {
      estudianteId: id,
      plan: 'Una prueba anual',
      estado: 'en_mora',
      pruebas: [base.pruebaId],
      periodoFin: new Date('2020-01-01'),
    });
    expect((await consultar(token)).body.data).toMatchObject({
      alcance: 'una_prueba',
      pruebasIncluidas: [base.pruebaId],
      coberturaVigente: true,
      estado: 'en_mora',
    });
  });

  it('F3: informa una activa antigua sin conceder cobertura', async () => {
    const { id, token } = await base.sesion('antigua@ejemplo.cl');
    await insertarSuscripcion(entorno.bd, {
      estudianteId: id,
      plan: 'Todas las pruebas anual',
      estado: 'activa',
      periodoFin: new Date('2020-01-01'),
    });
    expect((await consultar(token)).body.data).toMatchObject({
      alcance: 'todas',
      pruebasIncluidas: [],
      coberturaVigente: false,
    });
  });
});
