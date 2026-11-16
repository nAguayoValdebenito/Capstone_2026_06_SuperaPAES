// Modo de pruebas de suscripción (MODO_PRUEBAS_SUSCRIPCION), sin base de datos: el servicio crea la
// simulada activa del canal «prueba» con 30 días y su registro del historial, y la ruta
// POST /app/suscripciones/simulada solo existe con la bandera encendida. GET /planes lo informa en `meta`.
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { ErrorConflicto, ErrorNoEncontrado } from '../comun/errores.js';
import type { Ejecutor, UnidadDeTrabajo } from '../db/transaccion.js';
import {
  crearSimuladaServicio,
  DETALLE_SIMULADA,
  type DependenciasSimulada,
} from '../modulos/suscripciones/suscripciones.simulada.servicio.js';
import { crearServicios } from '../app.js';
import {
  crearAppDePrueba,
  crearDependenciasDePrueba,
  errorConFormato,
  tokenApp,
} from './ayudantes.js';

const AHORA = new Date('2026-11-16T12:00:00Z');
const EN_30_DIAS = new Date('2026-12-16T12:00:00Z');
const tx = { query: vi.fn() } as unknown as Ejecutor;
const unidadDeTrabajo: UnidadDeTrabajo = { enTransaccion: (trabajo) => trabajo(tx) };

function dependencias(cambios: Partial<DependenciasSimulada> = {}) {
  const simulada = {
    planActivo: vi.fn(() => Promise.resolve({ planId: 3, alcance: 'todas' as const })),
    tieneVigente: vi.fn(() => Promise.resolve(false)),
    insertarActiva: vi.fn(() => Promise.resolve('41')),
  };
  const compras = {
    pruebaExiste: vi.fn(() => Promise.resolve(true)),
    fijarPrueba: vi.fn(() => Promise.resolve()),
    registrarCambio: vi.fn(() => Promise.resolve()),
  };
  return {
    simulada,
    compras,
    todas: {
      unidadDeTrabajo,
      reloj: () => new Date(AHORA),
      modoPruebas: true,
      simulada,
      compras,
      ...cambios,
    } satisfies DependenciasSimulada,
  };
}

describe('servicio de la suscripción simulada', () => {
  it('crea la activa del canal prueba con 30 días y su primer registro con origen sistema', async () => {
    const { simulada, compras, todas } = dependencias();

    const creada = await crearSimuladaServicio(todas).crearSimulada('10', { planId: 3 });

    expect(creada).toEqual({
      id: '41',
      estado: 'activa',
      planId: 3,
      tienda: 'prueba',
      pruebaId: null,
      inicio: AHORA,
      periodoFin: EN_30_DIAS,
    });
    expect(simulada.insertarActiva).toHaveBeenCalledWith(
      { estudianteId: '10', planId: 3, ahora: AHORA, periodoFin: EN_30_DIAS },
      tx,
    );
    expect(compras.fijarPrueba).toHaveBeenCalledWith('41', null, tx);
    expect(compras.registrarCambio).toHaveBeenCalledWith(
      {
        suscripcionId: '41',
        estadoAnterior: null,
        estadoNuevo: 'activa',
        planAnterior: null,
        planNuevo: 3,
        origen: 'sistema',
        detalle: DETALLE_SIMULADA,
        ahora: AHORA,
      },
      tx,
    );
    expect(DETALLE_SIMULADA).toBe('Suscripción simulada (modo de pruebas)');
  });

  it('Una prueba guarda la prueba elegida (RN-05)', async () => {
    const { simulada, compras, todas } = dependencias();
    simulada.planActivo.mockResolvedValue({ planId: 1, alcance: 'una_prueba' } as never);

    const creada = await crearSimuladaServicio(todas).crearSimulada('10', {
      planId: 1,
      pruebaId: 2,
    });

    expect(creada.pruebaId).toBe(2);
    expect(compras.fijarPrueba).toHaveBeenCalledWith('41', 2, tx);
  });

  it('Una prueba sin prueba elegida no se crea', async () => {
    const { simulada, todas } = dependencias();
    simulada.planActivo.mockResolvedValue({ planId: 1, alcance: 'una_prueba' } as never);

    await expect(
      crearSimuladaServicio(todas).crearSimulada('10', { planId: 1 }),
    ).rejects.toMatchObject({ codigo: 'VALIDACION' });
    expect(simulada.insertarActiva).not.toHaveBeenCalled();
  });

  it('con la bandera apagada responde 404 sin tocar la base', async () => {
    const { simulada, todas } = dependencias({ modoPruebas: false });
    const servicio = crearSimuladaServicio(todas);

    expect(servicio.modoPruebasActivo()).toBe(false);
    await expect(servicio.crearSimulada('10', { planId: 3 })).rejects.toBeInstanceOf(
      ErrorNoEncontrado,
    );
    expect(simulada.planActivo).not.toHaveBeenCalled();
  });

  it('un plan inexistente o inactivo responde 404', async () => {
    const { simulada, todas } = dependencias();
    simulada.planActivo.mockResolvedValue(null as never);

    await expect(
      crearSimuladaServicio(todas).crearSimulada('10', { planId: 99 }),
    ).rejects.toBeInstanceOf(ErrorNoEncontrado);
  });

  it('con una vigente (pendiente, activa o en mora) responde 409 y no crea otra', async () => {
    const { simulada, todas } = dependencias();
    simulada.tieneVigente.mockResolvedValue(true);

    await expect(
      crearSimuladaServicio(todas).crearSimulada('10', { planId: 3 }),
    ).rejects.toBeInstanceOf(ErrorConflicto);
    expect(simulada.insertarActiva).not.toHaveBeenCalled();
  });

  it('dos pedidos a la vez: el índice de una sola vigente se traduce a 409', async () => {
    const { simulada, todas } = dependencias();
    simulada.insertarActiva.mockRejectedValue(
      Object.assign(new Error('duplicada'), {
        code: '23505',
        constraint: 'ux_suscripcion_vigente',
      }),
    );

    await expect(
      crearSimuladaServicio(todas).crearSimulada('10', { planId: 3 }),
    ).rejects.toBeInstanceOf(ErrorConflicto);
  });
});

const RUTA = '/api/v1/app/suscripciones';

/** App sin base con la bandera indicada y la creación y los planes reemplazados. */
function appCon(modoPruebas: boolean, crearSimulada = vi.fn()) {
  const cambios = { opcionesSuscripciones: { modoPruebas } };
  const reales = crearServicios(crearDependenciasDePrueba(cambios)).suscripciones;
  const suscripciones = {
    ...reales,
    planesOfrecidos: () => Promise.resolve([]),
    crearSimulada,
  };
  return { app: crearAppDePrueba(cambios, { suscripciones }), crearSimulada };
}

describe('POST /app/suscripciones/simulada', () => {
  it('con la bandera apagada la ruta no existe (404) y los planes no traen meta', async () => {
    const { app, crearSimulada } = appCon(false);
    const token = await tokenApp();

    const respuesta = await request(app)
      .post(`${RUTA}/simulada`)
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: 3 });
    const planes = await request(app).get(`${RUTA}/planes`).set('Authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual(errorConFormato('NO_ENCONTRADO'));
    expect(crearSimulada).not.toHaveBeenCalled();
    expect(planes.body).toEqual({ data: [], error: null, meta: null });
  });

  it('con la bandera encendida crea la simulada (201) y los planes lo informan', async () => {
    const crear = vi.fn(() =>
      Promise.resolve({
        id: '41',
        estado: 'activa',
        planId: 3,
        tienda: 'prueba',
        pruebaId: null,
        inicio: AHORA,
        periodoFin: EN_30_DIAS,
      }),
    );
    const { app } = appCon(true, crear);
    const token = await tokenApp('10');

    const respuesta = await request(app)
      .post(`${RUTA}/simulada`)
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: 3 });
    const planes = await request(app).get(`${RUTA}/planes`).set('Authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toEqual({
      id: 41,
      estado: 'activa',
      planId: 3,
      tienda: 'prueba',
      pruebaId: null,
      inicio: AHORA.toISOString(),
      periodoFin: EN_30_DIAS.toISOString(),
    });
    expect(crear).toHaveBeenCalledWith('10', { planId: 3 });
    expect(planes.body.meta).toEqual({ modoPruebas: true });
  });

  it('con una vigente responde 409', async () => {
    const crear = vi.fn(() => Promise.reject(new ErrorConflicto('Ya tienes una suscripción.')));
    const { app } = appCon(true, crear);

    const respuesta = await request(app)
      .post(`${RUTA}/simulada`)
      .set('Authorization', `Bearer ${await tokenApp()}`)
      .send({ planId: 3 });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual(errorConFormato('CONFLICTO'));
  });

  it('un plan inexistente responde 404', async () => {
    const crear = vi.fn(() => Promise.reject(new ErrorNoEncontrado('El plan no existe.')));
    const { app } = appCon(true, crear);

    const respuesta = await request(app)
      .post(`${RUTA}/simulada`)
      .set('Authorization', `Bearer ${await tokenApp()}`)
      .send({ planId: 999 });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual(errorConFormato('NO_ENCONTRADO'));
  });

  it('no acepta una tienda en el cuerpo ni funciona sin sesión', async () => {
    const { app, crearSimulada } = appCon(true);

    const conTienda = await request(app)
      .post(`${RUTA}/simulada`)
      .set('Authorization', `Bearer ${await tokenApp()}`)
      .send({ planId: 3, tienda: 'google_play' });
    const sinSesion = await request(app).post(`${RUTA}/simulada`).send({ planId: 3 });

    expect(conTienda.status).toBe(400);
    expect(sinSesion.status).toBe(401);
    expect(crearSimulada).not.toHaveBeenCalled();
  });
});
