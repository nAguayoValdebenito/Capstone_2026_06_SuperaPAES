// CP-12 (HU-52.1/52.2): persistencia y auditoría reales. Solo bases temporales terminadas en _test.
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanAdministrable } from '../modulos/suscripciones/suscripciones.planes.repositorio.js';
import { usarBaseDeSesiones } from './base-sesiones.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';
import { edicionDe, restaurarPlanes } from './planes-de-prueba.js';
import { insertarSuscripcion } from './suscripciones-de-prueba.js';

const RUTA = '/api/v1/admin/suscripciones/planes';
exigirBaseEnCi();
describe.skipIf(!urlBase)('administración de planes con PostgreSQL (CP-12)', () => {
  const entorno = usarBaseDeSesiones('administracion_planes');
  let originales: PlanAdministrable[];
  let plan: PlanAdministrable;
  let autorId: string;
  let token: string;
  const servicios = () => entorno.crearServiciosCon({});
  const guardar = async (datos: ReturnType<typeof edicionDe>, id = plan.id) =>
    request(entorno.app)
      .put(`${RUTA}/${String(id)}`)
      .set('Authorization', `Bearer ${token}`)
      .send(datos);
  const catalogo = async () => (await servicios().suscripciones.listarPlanes()).planes;
  const auditoria = async () =>
    (
      await entorno.bd.query<{
        antes: PlanAdministrable;
        despues: PlanAdministrable;
        autor: string;
      }>(
        `SELECT a.antes, a.despues, a.usuario_id::text AS autor FROM contenido.auditoria a
     JOIN contenido.accion_auditoria t ON t.id=a.accion_auditoria_id
     WHERE t.codigo='editar_plan' ORDER BY a.id`,
      )
    ).rows;

  beforeAll(async () => {
    originales = await catalogo();
  });
  beforeEach(async () => {
    await restaurarPlanes(entorno.bd, originales);
    plan = originales[0]!;
    const credenciales = await entorno.crearAdmin();
    const ingreso = await request(entorno.app)
      .post('/api/v1/admin/cuentas/ingreso')
      .send(credenciales);
    expect(ingreso.status).toBe(200);
    token = (ingreso.body.data as { tokenAcceso: string }).tokenAcceso;
    const { rows } = await entorno.bd.query<{ id: string }>(
      'SELECT id::text FROM contenido.usuario_interno',
    );
    autorId = rows[0]!.id;
  });

  it('lista también los desactivados, con las opciones y el formato de la API', async () => {
    await guardar({ ...edicionDe(plan), activo: false });
    const respuesta = await request(entorno.app).get(RUTA).set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      error: null,
      meta: null,
      data: {
        planes: expect.arrayContaining([expect.objectContaining({ id: plan.id, activo: false })]),
        alcances: expect.arrayContaining([plan.alcance]),
        periodicidades: expect.arrayContaining([plan.periodicidad]),
      },
    });
    expect(respuesta.body.data.planes).toHaveLength(originales.length);
  });

  it('guarda nombre, precio, productos y estado y audita los valores anterior y nuevo', async () => {
    const datos = {
      ...edicionDe(plan),
      nombre: 'Oferta revisada',
      precioClp: 3100,
      activo: false,
      productos: { google_play: 'oferta_revisada', app_store: 'oferta_revisada' },
    };
    const respuesta = await guardar(datos);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      nombre: datos.nombre,
      precioClp: datos.precioClp,
      productos: datos.productos,
      activo: false,
      alcance: plan.alcance,
      periodicidad: plan.periodicidad,
    });
    const guardado = (await catalogo()).find((p) => p.id === plan.id);
    expect(guardado).toEqual(respuesta.body.data);
    expect(await auditoria()).toEqual([{ antes: plan, despues: guardado, autor: autorId }]);
  });

  it('persiste un cambio de alcance y periodicidad si la combinación está libre', async () => {
    const destino = originales.at(-1)!;
    await entorno.bd.query('DELETE FROM contenido.plan_producto_tienda WHERE plan_id=$1', [
      destino.id,
    ]);
    await entorno.bd.query('DELETE FROM contenido.plan WHERE id=$1', [destino.id]);
    const respuesta = await guardar({
      ...edicionDe(plan),
      alcanceId: destino.alcance.id,
      periodicidadId: destino.periodicidad.id,
    });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      alcance: destino.alcance,
      periodicidad: destino.periodicidad,
    });
    expect((await catalogo()).find((p) => p.id === plan.id)).toEqual(respuesta.body.data);
  });

  it('la restricción existente de producto duplicado revierte también el precio y la otra tienda', async () => {
    const otra = originales[1]!;
    const respuesta = await guardar({
      ...edicionDe(plan),
      precioClp: 9900,
      productos: { google_play: 'cambio_a_revertir', app_store: otra.productos.app_store },
    });
    expect(respuesta.status).toBe(409);
    expect((await catalogo()).find((p) => p.id === plan.id)).toEqual(plan);
    expect(await auditoria()).toEqual([]);
  });

  it('rechaza nombre y combinación duplicados sin registrar cambios', async () => {
    const otra = originales[1]!;
    expect((await guardar({ ...edicionDe(plan), nombre: otra.nombre })).status).toBe(409);
    expect(
      (
        await guardar({
          ...edicionDe(plan),
          alcanceId: otra.alcance.id,
          periodicidadId: otra.periodicidad.id,
        })
      ).status,
    ).toBe(409);
    expect((await catalogo()).find((p) => p.id === plan.id)).toEqual(plan);
    expect(await auditoria()).toEqual([]);
  });

  it('al desactivar deja de ofrecer el plan y mantiene la suscripción ya contratada', async () => {
    const estudianteId = await crearEstudianteDePrueba(entorno.bd, {
      correo: 'plan@ejemplo.cl',
      contrasena: randomUUID(),
    });
    await insertarSuscripcion(entorno.bd, { estudianteId, plan: plan.nombre, estado: 'activa' });
    expect((await guardar({ ...edicionDe(plan), activo: false })).status).toBe(200);
    const suscripciones = servicios().suscripciones;
    expect((await suscripciones.planesOfrecidos()).map((p) => p.id)).not.toContain(plan.id);
    expect(await suscripciones.vigenteDe(estudianteId)).toMatchObject({
      plan: plan.alcance.nombre,
      estado: 'activa',
    });
    expect((await guardar(edicionDe(plan))).status).toBe(200);
    expect((await suscripciones.planesOfrecidos()).map((p) => p.id)).toContain(plan.id);
    expect(await auditoria()).toHaveLength(2);
  });

  it('si falla la auditoría se revierte el plan y sus dos productos', async () => {
    const s = servicios();
    vi.spyOn(s.administracion, 'registrarAuditoria').mockRejectedValue(
      new Error('Falla de auditoría'),
    );
    await expect(
      s.suscripciones.editarPlan(autorId, plan.id, {
        ...edicionDe(plan),
        precioClp: 7200,
        productos: { google_play: 'nuevo_producto', app_store: 'nuevo_producto' },
      }),
    ).rejects.toThrow('Falla de auditoría');
    expect((await catalogo()).find((p) => p.id === plan.id)).toEqual(plan);
  });

  it('editar un id ausente devuelve 404 y no crea un plan', async () => {
    expect((await guardar(edicionDe(plan), 32767)).status).toBe(404);
    expect(await catalogo()).toEqual(originales);
    expect(await auditoria()).toEqual([]);
  });
});
