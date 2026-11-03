// Trazabilidad de suscripciones en la consola (HU-56, CU-27, RF-C09, RN-17, RN-26). Contra PostgreSQL
// real (ver base-temporal.ts), por HTTP como la consola:
//   - Ana compró «Una prueba mensual» en Google Play, la tienda la activó y después la cambió a «Todas las
//     pruebas mensual»; tiene un pago aprobado.
//   - Beto, en la App Store con «Todas las pruebas anual», quedó en mora con un pago rechazado.
//   - Carla canceló «Una prueba mensual» y después eliminó su cuenta (seudonimizada).
//   - Dani tiene una suscripción vencida de enero.
//   - Un aviso de Google Play no se pudo procesar.
// Sin base: solo el administrador entra y los filtros se validan.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { crearApp, crearServicios } from '../app.js';
import { ejecutarEnTransaccion } from '../db/transaccion.js';
import {
  aceptarCualquierSesion,
  crearAppDePrueba,
  crearDependenciasDePrueba,
  tokenAdmin,
} from './ayudantes.js';
import {
  type BaseTemporal,
  crearBaseTemporal,
  exigirBaseEnCi,
  MINUTO,
  urlBase,
} from './base-temporal.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';
import {
  agregarAviso,
  agregarEvento,
  agregarPago,
  RUTA_SUSCRIPCIONES,
} from './trazabilidad-de-prueba.js';
import { insertarSuscripcion } from './suscripciones-de-prueba.js';

const TOKEN_DE_COMPRA = 'token-de-compra-que-no-se-muestra';
const MOTIVO = 'No se encontró la suscripción del token de compra.';

/** Los ids de la lista, en orden. */
const idsDe = (cuerpo: unknown) => (cuerpo as { data: { id: number }[] }).data.map((s) => s.id);

/** Un cambio de la línea de tiempo, como lo entrega la API. */
interface Paso {
  estadoAnterior: { codigo: string } | null;
  estadoNuevo: { codigo: string };
  planAnterior: string | null;
  planNuevo: string;
  origen: { codigo: string };
}

describe('trazabilidad de suscripciones sin base de datos', () => {
  exigirBaseEnCi();
  const app = crearAppDePrueba();

  it.each(['/resumen', '/', '/avisos-error', '/7'])(
    'el docente no entra a %s (403, HU-56 esc. 5)',
    async (ruta) => {
      const respuesta = await request(app)
        .get(`${RUTA_SUSCRIPCIONES}${ruta}`)
        .set('Authorization', `Bearer ${await tokenAdmin('docente', '21')}`);

      expect(respuesta.status).toBe(403);
    },
  );

  it.each([
    ['estado=Activa!', 'estado'],
    ['plan=0', 'plan'],
    ['desde=20-10-2026', 'desde'],
    ['desde=2026-10-20&hasta=2026-10-01', 'hasta'],
    ['otro=1', ''],
  ])('rechaza el filtro %s (400)', async (consulta) => {
    const respuesta = await request(app)
      .get(`${RUTA_SUSCRIPCIONES}/?${consulta}`)
      .set('Authorization', `Bearer ${await tokenAdmin()}`);

    expect(respuesta.status).toBe(400);
  });
});

describe.skipIf(!urlBase)('trazabilidad de suscripciones con PostgreSQL (HU-56)', () => {
  let base: BaseTemporal;
  let app: Express;
  const ids = { ana: '', beto: '', carla: '', dani: '' };

  const consultar = async (ruta: string) =>
    request(app)
      .get(`${RUTA_SUSCRIPCIONES}${ruta}`)
      .set('Authorization', `Bearer ${await tokenAdmin()}`);

  const estudiante = (nombre: string) =>
    crearEstudianteDePrueba(base.bd, {
      correo: `${nombre}@ejemplo.cl`,
      contrasena: 'clave-para-practicar',
    });

  async function prepararAna() {
    const id = await insertarSuscripcion(base.bd, {
      estudianteId: await estudiante('ana'),
      plan: 'Todas las pruebas mensual',
      estado: 'activa',
    });
    await base.bd.query('UPDATE app.suscripcion SET id_compra_tienda = $2 WHERE id = $1', [
      id,
      TOKEN_DE_COMPRA,
    ]);
    const pago = await agregarPago(base.bd, id, ['aprobado', 1990]);
    await agregarAviso(base.bd, ['gp-compra', 'SUBSCRIPTION_PURCHASED'], { pago });
    await agregarAviso(base.bd, ['gp-cambio', 'SUBSCRIPTION_PURCHASED'], { suscripcion: id });
    await agregarEvento(base.bd, id, [null, ['pendiente', 'Una prueba mensual']], ['estudiante']);
    await agregarEvento(
      base.bd,
      id,
      [
        ['pendiente', 'Una prueba mensual'],
        ['activa', 'Una prueba mensual'],
      ],
      ['pasarela', 'gp-compra'],
    );
    await agregarEvento(
      base.bd,
      id,
      [
        ['activa', 'Una prueba mensual'],
        ['activa', 'Todas las pruebas mensual'],
      ],
      ['pasarela', 'gp-cambio'],
    );
    return id;
  }

  async function prepararOtras() {
    ids.beto = await insertarSuscripcion(base.bd, {
      estudianteId: await estudiante('beto'),
      plan: 'Todas las pruebas anual',
      estado: 'en_mora',
      tienda: 'app_store',
    });
    await agregarPago(base.bd, ids.beto, ['rechazado', 23990]);
    const carla = await estudiante('carla');
    ids.carla = await insertarSuscripcion(base.bd, {
      estudianteId: carla,
      plan: 'Una prueba mensual',
      estado: 'cancelada',
    });
    await agregarEvento(base.bd, ids.carla, [null, ['activa', 'Una prueba mensual']], ['sistema']);
    await agregarEvento(
      base.bd,
      ids.carla,
      [
        ['activa', 'Una prueba mensual'],
        ['cancelada', 'Una prueba mensual'],
      ],
      ['estudiante'],
    );
    // Como al eliminar la cuenta (cuentas.eliminacion.repositorio.ts).
    await base.bd.query(
      `UPDATE app.estudiante SET nombre = 'Cuenta eliminada',
              correo = 'eliminada-' || id || '@cuentas.invalid', eliminado_en = now() WHERE id = $1`,
      [carla],
    );
    ids.dani = await insertarSuscripcion(base.bd, {
      estudianteId: await estudiante('dani'),
      plan: 'Una prueba anual',
      estado: 'vencida',
    });
    await base.bd.query(
      "UPDATE app.suscripcion SET creado_en = '2026-01-15T12:00:00-03:00' WHERE id = $1",
      [ids.dani],
    );
    await agregarAviso(base.bd, ['gp-error', 'SUBSCRIPTION_RENEWED'], { error: MOTIVO });
  }

  beforeAll(async () => {
    base = await crearBaseTemporal('trazabilidad');
    const dependencias = crearDependenciasDePrueba({
      bd: base.bd,
      unidadDeTrabajo: { enTransaccion: (trabajo) => ejecutarEnTransaccion(base.bd, trabajo) },
    });
    app = crearApp(dependencias, aceptarCualquierSesion(crearServicios(dependencias)));
    ids.ana = await prepararAna();
    await prepararOtras();
  }, 2 * MINUTO);

  afterAll(async () => {
    await base.cerrar();
  });

  it('resume las suscripciones por plan y estado, las altas y cancelaciones y los pagos del mes (esc. 1)', async () => {
    // El mes en curso en Chile, según la base (no según la zona del computador que corre la prueba).
    const { rows } = await base.bd.query<{ mes: string }>(
      "SELECT to_char(now() AT TIME ZONE 'America/Santiago', 'YYYY-MM') AS mes",
    );
    const mes = rows[0]?.mes;

    const { body, status } = await consultar('/resumen');

    expect(status).toBe(200);
    expect(body.data).toMatchObject({
      activas: 1,
      enMora: 1,
      altasDelMes: 3,
      cancelacionesDelMes: 1,
      ingresosDelMes: 1990,
      avisosConError: 1,
    });
    expect(body.data.porPlanYEstado).toContainEqual({
      plan: 'Todas las pruebas anual',
      estado: { codigo: 'en_mora', nombre: 'En mora' },
      suscripciones: 1,
    });
    expect(body.data.meses[0]).toEqual({
      mes,
      pagosAprobados: 1,
      pagosRechazados: 1,
      ingresosClp: 1990,
    });
    expect(body.data.estados).toHaveLength(6);
    expect(body.data.planes).toHaveLength(4);
  });

  it('lista las suscripciones, de la más nueva, sin el token de compra (esc. 2 y 5)', async () => {
    const { body, status } = await consultar('/');

    expect(status).toBe(200);
    expect(body.meta).toEqual({ pagina: 1, porPagina: 20, total: 4 });
    expect(idsDe(body)).toEqual([ids.carla, ids.beto, ids.ana, ids.dani].map(Number));
    expect(body.data[2]).toMatchObject({
      correo: 'ana@ejemplo.cl',
      plan: 'Todas las pruebas mensual',
      tienda: { codigo: 'google_play', nombre: 'Google Play' },
      estado: { codigo: 'activa', nombre: 'Activa' },
    });
    expect(body.data[0].correo).toBeNull();
    expect(JSON.stringify(body)).not.toContain(TOKEN_DE_COMPRA);
    expect(JSON.stringify(body)).not.toContain('eliminada-');
  });

  it.each([
    ['estado=en_mora', 'beto'],
    ['correo=ANA%40', 'ana'],
    ['desde=2026-01-01&hasta=2026-01-31', 'dani'],
  ] as const)('filtra con %s (esc. 2)', async (consulta, quien) => {
    const { body } = await consultar(`/?${consulta}`);

    expect(idsDe(body)).toEqual([Number(ids[quien])]);
  });

  it('filtra por plan y no encuentra a una cuenta eliminada por su correo (esc. 2 y 5)', async () => {
    const { planes } = (await consultar('/resumen')).body.data as {
      planes: { id: number; nombre: string }[];
    };
    const plan = planes.find((p) => p.nombre === 'Una prueba mensual')?.id;

    const porPlan = await consultar(`/?plan=${String(plan)}`);
    const eliminada = await consultar('/?correo=eliminada');

    expect(idsDe(porPlan.body)).toEqual([Number(ids.carla)]);
    expect(eliminada.body.data).toEqual([]);
    expect(eliminada.body.meta.total).toBe(0);
  });

  it('muestra la línea de tiempo con su origen, los pagos y los avisos de la tienda (esc. 3)', async () => {
    const { body, status } = await consultar(`/${ids.ana}`);

    expect(status).toBe(200);
    expect(body.data.id).toBe(Number(ids.ana));
    expect(
      (body.data.historial as Paso[]).map((h) => [
        h.estadoAnterior?.codigo ?? null,
        h.estadoNuevo.codigo,
        h.planAnterior,
        h.planNuevo,
        h.origen.codigo,
      ]),
    ).toEqual([
      ['activa', 'activa', 'Una prueba mensual', 'Todas las pruebas mensual', 'pasarela'],
      ['pendiente', 'activa', 'Una prueba mensual', 'Una prueba mensual', 'pasarela'],
      [null, 'pendiente', null, 'Una prueba mensual', 'estudiante'],
    ]);
    expect(body.data.pagos).toEqual([
      expect.objectContaining({
        montoClp: 1990,
        estado: { codigo: 'aprobado', nombre: 'Aprobado' },
      }),
    ]);
    expect((body.data.avisos as { tipo: string }[]).map((a) => a.tipo)).toEqual([
      'SUBSCRIPTION_PURCHASED',
      'SUBSCRIPTION_PURCHASED',
    ]);
    expect(JSON.stringify(body)).not.toContain(TOKEN_DE_COMPRA);
  });

  it('la suscripción de una cuenta eliminada sale sin correo; una que no existe da 404', async () => {
    const eliminada = await consultar(`/${ids.carla}`);
    const noExiste = await consultar('/999999');

    expect(eliminada.body.data.correo).toBeNull();
    expect(eliminada.body.data.historial).toHaveLength(2);
    expect(noExiste.status).toBe(404);
  });

  it('la bandeja muestra cada aviso con error y su motivo (esc. 4)', async () => {
    const { body, status } = await consultar('/avisos-error');

    expect(status).toBe(200);
    expect(body.meta).toEqual({ pagina: 1, porPagina: 20, total: 1 });
    expect(body.data).toEqual([
      expect.objectContaining({
        tipo: 'SUBSCRIPTION_RENEWED',
        tienda: { codigo: 'google_play', nombre: 'Google Play' },
        resultado: { codigo: 'error', nombre: 'Error' },
        detalle: MOTIVO,
        suscripcionId: null,
      }),
    ]);
  });
});
