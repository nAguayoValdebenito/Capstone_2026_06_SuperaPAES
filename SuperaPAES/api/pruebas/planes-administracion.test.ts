// HU-52.1/52.2, CP-12: transacción, validación y permisos. La nomenclatura de productos es HU-52.3.
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { ErrorNoEncontrado } from '../comun/errores.js';
import { crearPlanesServicio } from '../modulos/suscripciones/suscripciones.planes.servicio.js';
import { crearAppDePrueba, tokenAdmin } from './ayudantes.js';
import { edicionDe, PLAN } from './planes-de-prueba.js';

const RUTA = '/api/v1/admin/suscripciones/planes';

function preparar() {
  const bd = { query: vi.fn() };
  const repositorioPlanes = {
    listar: vi.fn().mockResolvedValue([PLAN]),
    obtener: vi.fn().mockResolvedValue(PLAN),
    opciones: vi
      .fn()
      .mockResolvedValue({ alcances: [PLAN.alcance], periodicidades: [PLAN.periodicidad] }),
    editar: vi.fn().mockResolvedValue(undefined),
  };
  const administracion = { registrarAuditoria: vi.fn().mockResolvedValue(undefined) };
  const servicio = crearPlanesServicio({
    bd,
    repositorioPlanes,
    administracion,
    unidadDeTrabajo: { enTransaccion: (trabajo) => trabajo(bd) },
  });
  return { bd, repositorioPlanes, administracion, servicio };
}

describe('edición de planes (HU-52, CU-24)', () => {
  it('devuelve planes y opciones con sus identificadores reales', async () => {
    const { servicio } = preparar();
    expect(await servicio.listarPlanes()).toEqual({
      planes: [PLAN],
      alcances: [PLAN.alcance],
      periodicidades: [PLAN.periodicidad],
    });
  });

  it('guarda y audita antes/después con el autor en la misma transacción (CP-12)', async () => {
    const { servicio, repositorioPlanes: r, administracion, bd } = preparar();
    const despues = { ...PLAN, precioClp: 2500, activo: false };
    r.obtener.mockResolvedValueOnce(PLAN).mockResolvedValueOnce(despues);
    expect(await servicio.editarPlan('71', PLAN.id, edicionDe(despues))).toEqual(despues);
    expect(r.obtener).toHaveBeenNthCalledWith(1, PLAN.id, bd, true);
    expect(r.editar).toHaveBeenCalledWith(PLAN.id, edicionDe(despues), bd);
    expect(administracion.registrarAuditoria).toHaveBeenCalledWith(
      {
        usuarioId: '71',
        accion: 'editar_plan',
        entidad: 'plan',
        entidadId: String(PLAN.id),
        antes: PLAN,
        despues,
      },
      bd,
    );
  });

  it('un plan inexistente no se crea ni se audita', async () => {
    const { servicio, repositorioPlanes: r, administracion } = preparar();
    r.obtener.mockResolvedValue(null);
    await expect(servicio.editarPlan('71', 32767, edicionDe(PLAN))).rejects.toBeInstanceOf(
      ErrorNoEncontrado,
    );
    expect(r.editar).not.toHaveBeenCalled();
    expect(administracion.registrarAuditoria).not.toHaveBeenCalled();
  });

  it.each(['alcanceId', 'periodicidadId'] as const)(
    'rechaza una opción inexistente: %s',
    async (campo) => {
      const { servicio, repositorioPlanes: r } = preparar();
      await expect(
        servicio.editarPlan('71', PLAN.id, { ...edicionDe(PLAN), [campo]: 30000 }),
      ).rejects.toMatchObject({ estadoHttp: 400, codigo: 'VALIDACION' });
      expect(r.editar).not.toHaveBeenCalled();
    },
  );

  it('la falla de auditoría aborta el trabajo transaccional', async () => {
    const { servicio, administracion } = preparar();
    administracion.registrarAuditoria.mockRejectedValue(new Error('Auditoría no disponible'));
    await expect(servicio.editarPlan('71', PLAN.id, edicionDe(PLAN))).rejects.toThrow(
      'Auditoría no disponible',
    );
  });
});

describe('rutas de Planes (CP-12 permisos y entrada)', () => {
  const app = crearAppDePrueba();
  it('sin sesión no entrega el catálogo', async () => {
    expect((await request(app).get(RUTA)).status).toBe(401);
  });
  it.each(['get', 'put'] as const)('un docente no puede %s planes', async (metodo) => {
    const ruta = metodo === 'get' ? RUTA : `${RUTA}/1`;
    const peticion = request(app);
    const respuesta = await peticion[metodo](ruta)
      .set('Authorization', `Bearer ${await tokenAdmin('docente')}`)
      .send(edicionDe(PLAN));
    expect(respuesta.status).toBe(403);
  });
  it.each([
    { precioClp: 0 },
    { precioClp: -1 },
    { precioClp: 1.5 },
    { precioClp: '1990' },
    { nombre: ' ' },
    { productos: { google_play: '', app_store: 'producto' } },
    { alcanceId: 0 },
    { periodicidadId: 0 },
    { activo: 'false' },
    { otro: true },
  ])('rechaza campos inválidos antes de guardar: %j', async (cambios) => {
    const respuesta = await request(app)
      .put(`${RUTA}/1`)
      .set('Authorization', `Bearer ${await tokenAdmin()}`)
      .send({ ...edicionDe(PLAN), ...cambios });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toMatchObject({
      data: null,
      error: { codigo: 'VALIDACION' },
      meta: null,
    });
  });
});
