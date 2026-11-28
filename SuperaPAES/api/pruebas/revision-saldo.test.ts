import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { crearServicios } from '../app.js';
import { crearSaldoDocenteServicio } from '../modulos/revision/revision.saldo.servicio.js';
import type { SaldoRepositorio } from '../modulos/revision/revision.saldo.repositorio.js';
import { crearAppDePrueba, crearDependenciasDePrueba, tokenAdmin, tokenApp } from './ayudantes.js';

const RUTA = '/api/v1/admin/revision';
const ahora = new Date('2026-11-28T15:00:00Z');
const tarifa = { id: '1', montoClp: 500, vigenteDesde: ahora, creadoEn: ahora };
function escenario() {
  const dependencias = crearDependenciasDePrueba();
  const revision = {
    ...crearServicios(dependencias).revision,
    consultarSaldo: vi.fn(() =>
      Promise.resolve({
        docente: { id: '21', nombre: 'Docente' },
        resumen: { totalClp: 1100, mesClp: 600, cantidad: 2, cantidadMes: 1 },
        capacidad: { pendientes: 3, completadas: 1, maxPendientes: 20, maxDiarias: 50 },
        detalle: [
          {
            revisionId: '7',
            preguntaId: '9',
            fecha: ahora.toISOString(),
            tipo: 'desempate' as const,
            montoClp: 600,
          },
        ],
        paginacion: { pagina: 1, porPagina: 20, total: 1 },
      }),
    ),
    consultarTarifas: vi.fn(() => Promise.resolve({ tarifas: [tarifa], docentes: [] })),
    registrarTarifa: vi.fn(() => Promise.resolve(tarifa)),
  };
  return { app: crearAppDePrueba({}, { revision }), revision };
}

describe('saldo docente y permisos', () => {
  it('exige sesión y rechaza tokens de estudiantes', async () => {
    const { app } = escenario();
    expect((await request(app).get(`${RUTA}/mi-saldo`)).status).toBe(401);
    expect(
      (
        await request(app)
          .get(`${RUTA}/mi-saldo`)
          .auth(await tokenApp(), { type: 'bearer' })
      ).status,
    ).toBe(401);
  });
  it('usa exclusivamente el docente de la sesión y convierte los identificadores', async () => {
    const { app, revision } = escenario();
    const respuesta = await request(app)
      .get(`${RUTA}/mi-saldo`)
      .auth(await tokenAdmin('docente', '21'), { type: 'bearer' });
    expect(respuesta.status).toBe(200);
    expect(revision.consultarSaldo).toHaveBeenCalledWith('21', { pagina: 1, porPagina: 20 });
    expect(respuesta.body.data.detalle[0]).toMatchObject({
      revisionId: 7,
      preguntaId: 9,
      montoClp: 600,
    });
    expect(respuesta.body.meta.total).toBe(1);
  });
  it('un docente no puede indicar otro docente ni administrar tarifas', async () => {
    const { app, revision } = escenario();
    const token = await tokenAdmin('docente', '21');
    for (const ruta of ['/saldos/22', '/tarifas'])
      expect(
        (
          await request(app)
            .get(RUTA + ruta)
            .auth(token, { type: 'bearer' })
        ).status,
      ).toBe(403);
    expect(
      (
        await request(app)
          .post(`${RUTA}/tarifas`)
          .auth(token, { type: 'bearer' })
          .send({ montoClp: 700, ultimaTarifaId: 1 })
      ).status,
    ).toBe(403);
    expect(
      (await request(app).get(`${RUTA}/mi-saldo?docenteId=22`).auth(token, { type: 'bearer' }))
        .status,
    ).toBe(400);
    expect(revision.consultarSaldo).not.toHaveBeenCalled();
  });
  it('el administrador consulta cualquier docente y registra tarifas', async () => {
    const { app, revision } = escenario();
    const token = await tokenAdmin();
    expect(
      (
        await request(app)
          .get(`${RUTA}/saldos/22?desde=2026-11-01&hasta=2026-11-28&pagina=2`)
          .auth(token, { type: 'bearer' })
      ).status,
    ).toBe(200);
    expect(revision.consultarSaldo).toHaveBeenCalledWith('22', {
      desde: '2026-11-01',
      hasta: '2026-11-28',
      pagina: 2,
      porPagina: 20,
    });
    expect(
      (
        await request(app)
          .post(`${RUTA}/tarifas`)
          .auth(token, { type: 'bearer' })
          .send({ montoClp: 600, ultimaTarifaId: 1 })
      ).status,
    ).toBe(201);
    expect(
      (await request(app).get(`${RUTA}/mi-saldo`).auth(token, { type: 'bearer' })).status,
    ).toBe(403);
  });
  it.each(['desde=2026-02-30', 'desde=2026-12-01&hasta=2026-11-01', 'pagina=0', 'porPagina=51'])(
    'valida la consulta %s',
    async (consulta) => {
      const { app } = escenario();
      expect(
        (
          await request(app)
            .get(`${RUTA}/mi-saldo?${consulta}`)
            .auth(await tokenAdmin('docente'), { type: 'bearer' })
        ).status,
      ).toBe(400);
    },
  );
  it.each([0, 701, 500.5, '500'])('rechaza tarifa inválida %s', async (montoClp) => {
    const { app } = escenario();
    expect(
      (
        await request(app)
          .post(`${RUTA}/tarifas`)
          .auth(await tokenAdmin(), { type: 'bearer' })
          .send({ montoClp, ultimaTarifaId: 1 })
      ).status,
    ).toBe(400);
  });
});

function servicioDeTarifas() {
  const tx = { query: vi.fn() };
  const repositorio: SaldoRepositorio = {
    reservarTarifas: vi.fn(() => Promise.resolve()),
    consultar: vi.fn(() => Promise.resolve(null)),
    listarTarifas: vi.fn(() => Promise.resolve([tarifa])),
    registrarTarifa: vi.fn(() => Promise.resolve({ ...tarifa, id: '2', montoClp: 600 })),
    docentes: vi.fn(() => Promise.resolve([])),
  };
  const registrarAuditoria = vi.fn(() => Promise.resolve());
  const servicio = crearSaldoDocenteServicio({
    bd: tx,
    unidadDeTrabajo: { enTransaccion: (trabajo) => trabajo(tx) },
    reloj: () => ahora,
    administracion: { registrarAuditoria },
    repositorioSaldo: repositorio,
  });
  return { servicio, repositorio, registrarAuditoria };
}
describe('historial de tarifas', () => {
  it('registra una nueva tarifa con auditoría y conserva la anterior', async () => {
    const { servicio, repositorio, registrarAuditoria } = servicioDeTarifas();
    await servicio.registrarTarifa('1', { montoClp: 600, ultimaTarifaId: 1 });
    expect(repositorio.registrarTarifa).toHaveBeenCalledWith(
      '1',
      { montoClp: 600, ultimaTarifaId: 1 },
      expect.anything(),
    );
    expect(registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'registrar_tarifa_revision', antes: null }),
      expect.anything(),
    );
    expect(tarifa.montoClp).toBe(500);
  });
  it('rechaza vigencias pasadas y un historial desactualizado', async () => {
    const { servicio, repositorio } = servicioDeTarifas();
    await expect(
      servicio.registrarTarifa('1', {
        montoClp: 600,
        ultimaTarifaId: 1,
        vigenteDesde: '2026-11-27T00:00:00Z',
      }),
    ).rejects.toMatchObject({ estadoHttp: 400 });
    await expect(
      servicio.registrarTarifa('1', { montoClp: 600, ultimaTarifaId: 2 }),
    ).rejects.toMatchObject({ estadoHttp: 409 });
    expect(repositorio.registrarTarifa).not.toHaveBeenCalled();
  });
});
