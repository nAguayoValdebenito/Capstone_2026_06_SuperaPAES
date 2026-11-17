// Modo de pruebas de suscripción contra PostgreSQL real: POST /app/suscripciones/simulada crea una activa del
// canal «prueba» (migración 012) con su registro en el historial, sin pago, y la consola la ve en la
// trazabilidad (HU-56) separada de los ingresos. La compra, los avisos de las tiendas, el cierre de
// canceladas y el aviso de renovación la dejan fuera.
import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAvisosRepositorio } from '../modulos/suscripciones/suscripciones.avisos.repositorio.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararPracticas } from './base-practicas.js';
import { errorConFormato } from './ayudantes.js';
import {
  historialDe,
  insertarSuscripcion,
  pagosDe,
  suscripcionGuardada,
} from './suscripciones-de-prueba.js';

const RUTA = '/api/v1/app/suscripciones';
const AHORA = new Date('2027-03-10T15:00:00.000Z');
const DIA = 86_400_000;
const enDias = (dias: number) => new Date(AHORA.getTime() + dias * DIA);

exigirBaseEnCi();
describe.skipIf(!urlBase)('suscripción simulada del modo de pruebas con PostgreSQL', () => {
  const base = prepararPracticas('simulada');
  const { entorno } = base;
  const planes: Record<string, number> = {};
  let app: Express;
  let siguiente = 0;

  beforeAll(async () => {
    app = entorno.crearAppCon({ opcionesSuscripciones: { modoPruebas: true } });
    const { rows } = await entorno.bd.query<{ nombre: string; id: number }>(
      'SELECT nombre, id FROM contenido.plan',
    );
    for (const plan of rows) planes[plan.nombre] = plan.id;
  });
  beforeEach(() => {
    entorno.fijarHora(AHORA);
  });

  const sesion = () => base.sesion(`simu${String(++siguiente)}@ejemplo.cl`);
  const simular = (token: string, cuerpo: Record<string, unknown>, en: Express = app) =>
    request(en).post(`${RUTA}/simulada`).set('Authorization', `Bearer ${token}`).send(cuerpo);
  const servicios = () => entorno.crearServiciosCon({});

  it('crea la activa del canal prueba con 30 días, su historial y ningún pago', async () => {
    const { token } = await sesion();
    const planId = planes['Todas las pruebas mensual'];

    const respuesta = await simular(token, { planId });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toEqual({
      id: expect.any(Number) as number,
      estado: 'activa',
      planId,
      tienda: 'prueba',
      pruebaId: null,
      inicio: AHORA.toISOString(),
      periodoFin: enDias(30).toISOString(),
    });
    const id = respuesta.body.data.id as number;
    expect(await suscripcionGuardada(entorno.bd, id)).toEqual({
      estado: 'activa',
      vigente: true,
      planId,
      tienda: 'prueba',
      idCompraTienda: null,
      inicio: AHORA,
      periodoFin: enDias(30),
      creadoEn: AHORA,
      pruebas: null,
    });
    expect(await historialDe(entorno.bd, id)).toEqual([
      {
        estadoAnterior: null,
        estadoNuevo: 'activa',
        planAnterior: null,
        planNuevo: planId,
        origen: 'sistema',
        creadoEn: AHORA,
      },
    ]);
    const { rows } = await entorno.bd.query<{ detalle: string }>(
      'SELECT detalle FROM app.suscripcion_evento WHERE suscripcion_id = $1',
      [id],
    );
    expect(rows[0]?.detalle).toBe('Suscripción simulada (modo de pruebas)');
    expect(await pagosDe(entorno.bd, id)).toEqual([]);
  });

  it('Una prueba guarda la prueba elegida', async () => {
    const { token } = await sesion();
    const { rows } = await entorno.bd.query<{ id: number }>(
      "SELECT id FROM contenido.prueba WHERE codigo = 'M1'",
    );
    const pruebaId = rows[0]?.id;

    const respuesta = await simular(token, { planId: planes['Una prueba mensual'], pruebaId });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.pruebaId).toBe(pruebaId);
  });

  it('con una vigente responde 409, y la simulada también bloquea una pendiente de tienda', async () => {
    const { token } = await sesion();
    const planId = planes['Todas las pruebas mensual'];
    expect((await simular(token, { planId })).status).toBe(201);

    const otra = await simular(token, { planId });
    const pendiente = await request(app)
      .post(RUTA)
      .set('Authorization', `Bearer ${token}`)
      .send({ planId, tienda: 'google_play' });

    expect(otra.status).toBe(409);
    expect(otra.body).toEqual(errorConFormato('CONFLICTO'));
    expect(pendiente.status).toBe(409);
  });

  it('con una pendiente de tienda también responde 409', async () => {
    const { token, id: estudianteId } = await sesion();
    await insertarSuscripcion(entorno.bd, {
      estudianteId,
      plan: 'Todas las pruebas mensual',
      estado: 'pendiente',
    });

    const respuesta = await simular(token, { planId: planes['Todas las pruebas mensual'] });

    expect(respuesta.status).toBe(409);
  });

  it('un plan inexistente o inactivo responde 404', async () => {
    const { token } = await sesion();
    const inactivo = planes['Una prueba anual'];
    await entorno.bd.query('UPDATE contenido.plan SET activo = false WHERE id = $1', [inactivo]);
    try {
      expect((await simular(token, { planId: 32000 })).status).toBe(404);
      expect((await simular(token, { planId: inactivo, pruebaId: 1 })).status).toBe(404);
    } finally {
      await entorno.bd.query('UPDATE contenido.plan SET activo = true WHERE id = $1', [inactivo]);
    }
  });

  it('con la bandera apagada la ruta no existe y nada se crea', async () => {
    const { token, id: estudianteId } = await sesion();

    const respuesta = await simular(
      token,
      { planId: planes['Todas las pruebas mensual'] },
      entorno.app,
    );

    expect(respuesta.status).toBe(404);
    const { rows } = await entorno.bd.query(
      'SELECT 1 FROM app.suscripcion WHERE estudiante_id = $1',
      [estudianteId],
    );
    expect(rows).toEqual([]);
  });

  it('Mi suscripción la muestra sin dirección de tienda y la compra no la encuentra', async () => {
    const { token } = await sesion();
    const creada = await simular(token, { planId: planes['Todas las pruebas mensual'] });
    const id = creada.body.data.id as number;

    const actual = await request(app).get(`${RUTA}/actual`).set('Authorization', `Bearer ${token}`);
    const compra = await request(app)
      .post(`${RUTA}/${String(id)}/compra`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idCompraTienda: 'compra-falsa' });

    expect(actual.status).toBe(200);
    expect(actual.body.data).toMatchObject({
      estado: 'activa',
      tienda: 'prueba',
      gestionUrl: null,
      coberturaVigente: true,
    });
    expect(compra.status).toBe(404);
  });

  it('no suma pagos ni ingresos, y la consola la ve como simulada', async () => {
    const { token } = await sesion();
    const creada = await simular(token, { planId: planes['Todas las pruebas mensual'] });
    const id = String(creada.body.data.id as number);
    const suscripciones = servicios().suscripciones;

    const { rows: pagos } = await entorno.bd.query(
      "SELECT * FROM app.v_pagos_mes WHERE tienda = 'prueba'",
    );
    const resumen = await suscripciones.resumenSuscripciones();
    const detalle = await suscripciones.detalleSuscripcion(id);
    const lista = await suscripciones.listarSuscripciones({ pagina: 1, porPagina: 50 });

    expect(pagos).toEqual([]);
    expect(resumen.simuladas).toBeGreaterThanOrEqual(1);
    expect(resumen.activas).toBe(0);
    expect(resumen.altasDelMes).toBe(0);
    expect(resumen.ingresosDelMes).toBe(0);
    expect(resumen.porPlanYEstado.filter((f) => f.estado.codigo === 'activa')).toEqual([]);
    expect(detalle.tienda).toEqual({ codigo: 'prueba', nombre: 'Prueba (simulada)' });
    expect(detalle.pagos).toEqual([]);
    expect(detalle.historial[0]?.detalle).toBe('Suscripción simulada (modo de pruebas)');
    expect(lista.suscripciones.find((s) => s.id === id)?.tienda.codigo).toBe('prueba');
  });

  it('el cierre de canceladas y el aviso de renovación la dejan fuera', async () => {
    const cancelada = await sesion();
    const idCancelada = await insertarSuscripcion(entorno.bd, {
      estudianteId: cancelada.id,
      plan: 'Todas las pruebas mensual',
      estado: 'activa',
      tienda: 'prueba',
      periodoFin: enDias(-5),
      canceladaEn: enDias(-20),
    });
    const anual = await sesion();
    await insertarSuscripcion(entorno.bd, {
      estudianteId: anual.id,
      plan: 'Todas las pruebas anual',
      estado: 'activa',
      tienda: 'prueba',
      periodoFin: enDias(3),
    });
    const suscripciones = servicios().suscripciones;

    expect(await suscripciones.cerrarCanceladasVencidas()).toBe(0);
    expect(await suscripciones.avisarRenovaciones()).toEqual({ enviados: 0, fallidos: 0 });
    expect((await suscripcionGuardada(entorno.bd, Number(idCancelada)))?.estado).toBe('activa');
    expect(entorno.correos.filter((m) => m.asunto.startsWith('Tu plan anual'))).toEqual([]);
  });

  it('los avisos de las tiendas no la ligan (tampoco a una pendiente simulada)', async () => {
    const { id: estudianteId } = await sesion();
    const id = await insertarSuscripcion(entorno.bd, {
      estudianteId,
      plan: 'Todas las pruebas mensual',
      estado: 'pendiente',
      tienda: 'prueba',
    });
    const avisos = crearAvisosRepositorio(entorno.bd);

    expect(await avisos.sinCompra('google_play')).not.toContain(id);
    expect(await avisos.sinCompra('app_store')).not.toContain(id);
  });
});
