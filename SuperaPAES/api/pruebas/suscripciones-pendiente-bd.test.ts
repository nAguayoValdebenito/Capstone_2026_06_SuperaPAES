// HU-43.1, CU-12 pasos 2 y 3, contra PostgreSQL real: POST /app/suscripciones crea la suscripción
// pendiente del plan elegido (y la prueba de «Una prueba») y entrega el producto de la tienda y la
// cuenta que la app pasa a la compra. Una pendiente se reutiliza; con una activa o en mora, la compra
// del nuevo plan se hace en la tienda (409). El historial parte en pendiente, con origen estudiante.
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararPracticas } from './base-practicas.js';
import { errorConFormato } from './ayudantes.js';
import { insertarSuscripcion } from './suscripciones-de-prueba.js';

const RUTA = '/api/v1/app/suscripciones';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

exigirBaseEnCi();
describe.skipIf(!urlBase)('suscripción pendiente con PostgreSQL (HU-43.1, CU-12 paso 3)', () => {
  const base = prepararPracticas('pendiente');
  const { entorno } = base;
  const planes: Record<string, number> = {};

  beforeAll(async () => {
    const { rows } = await entorno.bd.query<{ nombre: string; id: number }>(
      'SELECT nombre, id FROM contenido.plan',
    );
    for (const plan of rows) planes[plan.nombre] = plan.id;
  });

  const crear = (token: string, cuerpo: Record<string, unknown>) =>
    request(entorno.app).post(RUTA).set('Authorization', `Bearer ${token}`).send(cuerpo);

  /** La suscripción tal como quedó en la base, con su prueba elegida. */
  async function guardada(id: number) {
    const { rows } = await entorno.bd.query<Record<string, unknown>>(
      `SELECT e.codigo AS estado, s.vigente, s.plan_id AS "planId", c.codigo AS tienda,
              s.id_compra_tienda AS "idCompraTienda", s.creado_en AS "creadoEn",
              (SELECT array_agg(prueba_id) FROM app.suscripcion_prueba WHERE suscripcion_id = s.id)
                AS pruebas
         FROM app.suscripcion s
         JOIN contenido.estado_suscripcion e ON e.id = s.estado_suscripcion_id
         JOIN contenido.canal_venta c ON c.id = s.canal_venta_id
        WHERE s.id = $1`,
      [id],
    );
    return rows[0];
  }

  /** El historial de la suscripción, en orden. */
  async function historial(id: number) {
    const { rows } = await entorno.bd.query<Record<string, unknown>>(
      `SELECT ea.codigo AS "estadoAnterior", en.codigo AS "estadoNuevo",
              h.plan_anterior_id AS "planAnterior", h.plan_nuevo_id AS "planNuevo",
              o.codigo AS origen, h.creado_en AS "creadoEn"
         FROM app.suscripcion_evento h
         LEFT JOIN contenido.estado_suscripcion ea ON ea.id = h.estado_anterior_id
         JOIN contenido.estado_suscripcion en ON en.id = h.estado_nuevo_id
         JOIN contenido.origen_evento o ON o.id = h.origen_evento_id
        WHERE h.suscripcion_id = $1
        ORDER BY h.creado_en, h.id`,
      [id],
    );
    return rows;
  }

  async function cuantasDe(estudianteId: string): Promise<number> {
    const { rows } = await entorno.bd.query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM app.suscripcion WHERE estudiante_id = $1',
      [estudianteId],
    );
    return rows[0]?.n ?? 0;
  }

  it('crea la pendiente de Todas las pruebas con el producto de la tienda y su historial', async () => {
    const { token } = await base.sesion('ana@ejemplo.cl');
    const planId = planes['Todas las pruebas mensual'];

    const respuesta = await crear(token, { planId, tienda: 'google_play' });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toEqual({
      id: expect.any(Number) as number,
      estado: 'pendiente',
      planId,
      tienda: 'google_play',
      pruebaId: null,
      idProducto: 'todas_mensual',
      cuentaTienda: expect.stringMatching(UUID) as string,
      periodoFin: null,
      cambioEnRenovacion: null,
    });
    const id = respuesta.body.data.id as number;
    expect(await guardada(id)).toEqual({
      estado: 'pendiente',
      vigente: true,
      planId,
      tienda: 'google_play',
      idCompraTienda: null,
      creadoEn: entorno.ahora(),
      pruebas: null,
    });
    expect(await historial(id)).toEqual([
      {
        estadoAnterior: null,
        estadoNuevo: 'pendiente',
        planAnterior: null,
        planNuevo: planId,
        origen: 'estudiante',
        creadoEn: entorno.ahora(),
      },
    ]);
  });

  it('Una prueba guarda la prueba elegida y entrega el producto de la App Store', async () => {
    const { token } = await base.sesion('ana@ejemplo.cl');

    const respuesta = await crear(token, {
      planId: planes['Una prueba anual'],
      tienda: 'app_store',
      pruebaId: base.lectoraId,
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toMatchObject({
      tienda: 'app_store',
      pruebaId: base.lectoraId,
      idProducto: 'una_prueba_anual',
    });
    expect((await guardada(respuesta.body.data.id as number))?.pruebas).toEqual([base.lectoraId]);
  });

  it.each([
    ['Una prueba mensual', {}, 'prueba_requerida'],
    ['Todas las pruebas mensual', { pruebaId: 1 }, 'prueba_no_corresponde'],
    ['Una prueba mensual', { pruebaId: 32000 }, 'prueba_inexistente'],
  ])('%s con %j: 400 VALIDACION (%s) y no guarda nada', async (plan, extra, motivo) => {
    const { id, token } = await base.sesion('ana@ejemplo.cl');

    const respuesta = await crear(token, { planId: planes[plan], tienda: 'google_play', ...extra });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toMatchObject({
      codigo: 'VALIDACION',
      detalles: [{ lugar: 'cuerpo', ruta: 'pruebaId', motivo }],
    });
    expect(await cuantasDe(id)).toBe(0);
  });

  it('un plan inexistente o inactivo responde 404 y no guarda nada', async () => {
    const { id, token } = await base.sesion('ana@ejemplo.cl');
    const planId = planes['Todas las pruebas anual'];
    await entorno.bd.query('UPDATE contenido.plan SET activo = false WHERE id = $1', [planId]);
    try {
      const inactivo = await crear(token, { planId, tienda: 'google_play' });
      const inexistente = await crear(token, { planId: 32000, tienda: 'google_play' });

      expect(inactivo.status).toBe(404);
      expect(inactivo.body).toEqual(errorConFormato('NO_ENCONTRADO'));
      expect(inexistente.status).toBe(404);
      expect(await cuantasDe(id)).toBe(0);
    } finally {
      await entorno.bd.query('UPDATE contenido.plan SET activo = true WHERE id = $1', [planId]);
    }
  });

  it('valida el cuerpo y exige la sesión de la app', async () => {
    const { token } = await base.sesion('ana@ejemplo.cl');
    const planId = planes['Todas las pruebas mensual'];

    const tiendaInvalida = await crear(token, { planId, tienda: 'stripe' });
    const campoDeMas = await crear(token, { planId, tienda: 'google_play', estado: 'activa' });
    const sinSesion = await request(entorno.app).post(RUTA).send({ planId, tienda: 'google_play' });

    expect(tiendaInvalida.status).toBe(400);
    expect(tiendaInvalida.body.error.codigo).toBe('VALIDACION');
    expect(campoDeMas.status).toBe(400);
    expect(sinSesion.status).toBe(401);
  });

  it('reutiliza la pendiente: cambia el plan, la tienda y la prueba y registra el cambio de plan', async () => {
    const { id: estudianteId, token } = await base.sesion('ana@ejemplo.cl');
    const primera = await crear(token, {
      planId: planes['Una prueba mensual'],
      tienda: 'google_play',
      pruebaId: base.pruebaId,
    });
    const id = primera.body.data.id as number;
    entorno.avanzarSegundos(60);

    const otra = await crear(token, {
      planId: planes['Todas las pruebas anual'],
      tienda: 'app_store',
    });

    expect(otra.status).toBe(200);
    expect(otra.body.data).toMatchObject({
      id,
      planId: planes['Todas las pruebas anual'],
      tienda: 'app_store',
      pruebaId: null,
      idProducto: 'todas_anual',
      cuentaTienda: primera.body.data.cuentaTienda as string,
    });
    expect(await cuantasDe(estudianteId)).toBe(1);
    expect(await guardada(id)).toMatchObject({ tienda: 'app_store', pruebas: null });
    expect(await historial(id)).toEqual([
      expect.objectContaining({
        estadoNuevo: 'pendiente',
        planNuevo: planes['Una prueba mensual'],
      }),
      {
        estadoAnterior: 'pendiente',
        estadoNuevo: 'pendiente',
        planAnterior: planes['Una prueba mensual'],
        planNuevo: planes['Todas las pruebas anual'],
        origen: 'estudiante',
        creadoEn: entorno.ahora(),
      },
    ]);
  });

  it('repetir el mismo plan devuelve la misma pendiente sin agregar historial', async () => {
    const { token } = await base.sesion('ana@ejemplo.cl');
    const cuerpo = { planId: planes['Todas las pruebas mensual'], tienda: 'google_play' };
    const primera = await crear(token, cuerpo);

    const segunda = await crear(token, cuerpo);

    expect(segunda.status).toBe(200);
    expect(segunda.body.data).toEqual(primera.body.data);
    expect(await historial(primera.body.data.id as number)).toHaveLength(1);
  });

  it('dos pedidos a la vez dejan una sola pendiente', async () => {
    const { id: estudianteId, token } = await base.sesion('ana@ejemplo.cl');
    const cuerpo = { planId: planes['Todas las pruebas mensual'], tienda: 'google_play' };

    const [una, otra] = await Promise.all([crear(token, cuerpo), crear(token, cuerpo)]);

    expect([una.status, otra.status].sort()).toEqual([200, 201]);
    expect(una.body.data.id).toBe(otra.body.data.id);
    expect(await cuantasDe(estudianteId)).toBe(1);
  });

  it.each(['activa', 'en_mora'])(
    'con una suscripción %s responde 409 CONFLICTO: el cambio de plan se compra en la tienda',
    async (estado) => {
      const { id: estudianteId, token } = await base.sesion('ana@ejemplo.cl');
      await insertarSuscripcion(entorno.bd, {
        estudianteId,
        plan: 'Una prueba mensual',
        estado,
        pruebas: [base.pruebaId],
      });

      const respuesta = await crear(token, {
        planId: planes['Todas las pruebas mensual'],
        tienda: 'google_play',
      });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body).toEqual(errorConFormato('CONFLICTO'));
      expect(await cuantasDe(estudianteId)).toBe(1);
    },
  );

  it('después de una fallida, cancelada o vencida crea una pendiente nueva', async () => {
    const { id: estudianteId, token } = await base.sesion('ana@ejemplo.cl');
    for (const estado of ['fallida', 'cancelada', 'vencida'])
      await insertarSuscripcion(entorno.bd, {
        estudianteId,
        plan: 'Todas las pruebas mensual',
        estado,
      });

    const respuesta = await crear(token, {
      planId: planes['Todas las pruebas mensual'],
      tienda: 'google_play',
    });

    expect(respuesta.status).toBe(201);
    expect(await cuantasDe(estudianteId)).toBe(4);
  });

  it('cada estudiante tiene su propia pendiente y su propia cuenta en la tienda', async () => {
    const ana = await base.sesion('ana@ejemplo.cl');
    const beto = await base.sesion('beto@ejemplo.cl');
    const cuerpo = { planId: planes['Todas las pruebas mensual'], tienda: 'google_play' };

    const deAna = await crear(ana.token, cuerpo);
    const deBeto = await crear(beto.token, cuerpo);

    expect(deBeto.status).toBe(201);
    expect(deBeto.body.data.id).not.toBe(deAna.body.data.id);
    expect(deBeto.body.data.cuentaTienda).not.toBe(deAna.body.data.cuentaTienda);
  });
});
