// HU-45.3 (CU-12 4.c, RN-05, DAS 4.3.3 y 4.5.5), contra PostgreSQL real y por la ruta de la tarea horaria: el
// aviso por correo 7 días antes de renovar un plan anual, una sola vez por período, reintentando el que falló.
import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararPracticas } from './base-practicas.js';
import { insertarSuscripcion, type SuscripcionDePrueba } from './suscripciones-de-prueba.js';

const RUTA = '/api/v1/tareas/periodicas';
const CLAVE = 'clave-de-las-tareas';
const AHORA = new Date('2027-02-22T15:00:00.000Z');
const DIA = 86_400_000;
const enDias = (dias: number) => new Date(AHORA.getTime() + dias * DIA);

exigirBaseEnCi();
describe.skipIf(!urlBase)('aviso de renovación anual con PostgreSQL (HU-45.3)', () => {
  const base = prepararPracticas('renovacion');
  const { entorno } = base;
  let app: Express;
  let siguiente = 0;

  beforeAll(() => {
    app = entorno.crearAppCon({ claveTareas: CLAVE, paqueteGooglePlay: 'cl.superapaes.app' });
  });
  beforeEach(() => {
    entorno.fijarHora(AHORA);
  });

  const tarea = async () => {
    const respuesta = await request(app).post(RUTA).set('Authorization', `Bearer ${CLAVE}`);
    expect(respuesta.status).toBe(200);
    return respuesta.body.data as { avisosRenovacion: number; avisosRenovacionFallidos: number };
  };
  const avisos = () => entorno.correos.filter((m) => m.asunto.startsWith('Tu plan anual'));

  /** Un estudiante con su suscripción: por defecto, anual, activa y renovando en 5 días. */
  async function suscribir(cambios: Partial<SuscripcionDePrueba> = {}) {
    const correo = `renueva${String(++siguiente)}@ejemplo.cl`;
    const { id: estudianteId } = await base.sesion(correo);
    const id = await insertarSuscripcion(entorno.bd, {
      estudianteId,
      plan: 'Todas las pruebas anual',
      estado: 'activa',
      periodoFin: enDias(5),
      ...cambios,
    });
    return { id, estudianteId, correo };
  }

  const registros = async (id: string) => {
    const { rows } = await entorno.bd.query<Record<string, unknown>>(
      `SELECT a.usuario_id AS "usuarioId", x.codigo AS accion, a.antes, a.despues
         FROM contenido.auditoria a
         JOIN contenido.accion_auditoria x ON x.id = a.accion_auditoria_id
        WHERE a.entidad = 'suscripcion' AND a.entidad_id = $1`,
      [id],
    );
    return rows;
  };

  it('avisa una sola vez y lo registra en la auditoría como hecho por el sistema', async () => {
    const { id, correo } = await suscribir();

    expect(await tarea()).toMatchObject({ avisosRenovacion: 1, avisosRenovacionFallidos: 0 });
    expect(await tarea()).toMatchObject({ avisosRenovacion: 0, avisosRenovacionFallidos: 0 });

    expect(avisos()).toHaveLength(1);
    expect(avisos()[0]?.para).toBe(correo);
    expect(avisos()[0]?.texto).toContain('$23.990');
    expect(avisos()[0]?.texto).toContain('sku=todas_anual&package=cl.superapaes.app');
    expect(await registros(id)).toEqual([
      {
        usuarioId: null,
        accion: 'avisar_renovacion',
        antes: null,
        despues: { periodoFin: enDias(5).toISOString() },
      },
    ]);
  });

  it('dos ejecuciones simultáneas envían un solo correo', async () => {
    await suscribir();

    await Promise.all([tarea(), tarea()]);

    expect(avisos()).toHaveLength(1);
  });

  it('avisa justo a los 7 días, y no a los 8 ni a un período ya terminado', async () => {
    await suscribir({ periodoFin: enDias(7) });
    await suscribir({ periodoFin: new Date(enDias(7).getTime() + 1000) });
    await suscribir({ periodoFin: enDias(-1) });

    expect(await tarea()).toMatchObject({ avisosRenovacion: 1 });
  });

  it.each<[string, Partial<SuscripcionDePrueba>]>([
    ['mensual', { plan: 'Todas las pruebas mensual' }],
    ['en mora', { estado: 'en_mora' }],
    ['vencida', { estado: 'vencida' }],
    ['que canceló la renovación', { canceladaEn: enDias(-30) }],
  ])('no avisa a una suscripción %s', async (_caso, cambios) => {
    await suscribir(cambios);

    expect(await tarea()).toMatchObject({ avisosRenovacion: 0, avisosRenovacionFallidos: 0 });
    expect(avisos()).toHaveLength(0);
  });

  it('no avisa a una cuenta borrada, aunque la tienda siga cobrando (RN-34)', async () => {
    const { estudianteId } = await suscribir();
    await entorno.bd.query('UPDATE app.estudiante SET eliminado_en = $2 WHERE id = $1', [
      estudianteId,
      AHORA,
    ]);

    expect(await tarea()).toMatchObject({ avisosRenovacion: 0, avisosRenovacionFallidos: 0 });
    expect(avisos()).toHaveLength(0);
  });

  it('reintenta en la hora siguiente el aviso que no salió (DAS 4.5.5)', async () => {
    const { id } = await suscribir();
    entorno.fallarCorreo(true);

    expect(await tarea()).toMatchObject({ avisosRenovacion: 0, avisosRenovacionFallidos: 1 });
    expect(await registros(id)).toEqual([]);

    entorno.fallarCorreo(false);
    entorno.avanzarSegundos(3600);

    expect(await tarea()).toMatchObject({ avisosRenovacion: 1, avisosRenovacionFallidos: 0 });
    expect(await registros(id)).toHaveLength(1);
  });

  it('vuelve a avisar antes de la renovación del período siguiente', async () => {
    const { id } = await suscribir();
    await tarea();
    const siguienteFin = enDias(370);
    await entorno.bd.query('UPDATE app.suscripcion SET periodo_fin = $2 WHERE id = $1', [
      id,
      siguienteFin,
    ]);
    entorno.fijarHora(enDias(366));

    expect(await tarea()).toMatchObject({ avisosRenovacion: 1 });

    expect(avisos()).toHaveLength(2);
    expect(await registros(id)).toHaveLength(2);
  });

  it('la ruta sigue protegida por su clave y sin ella no avisa', async () => {
    await suscribir();

    const respuesta = await request(app).post(RUTA).set('Authorization', 'Bearer otra-clave');

    expect(respuesta.status).toBe(401);
    expect(avisos()).toHaveLength(0);
  });
});
