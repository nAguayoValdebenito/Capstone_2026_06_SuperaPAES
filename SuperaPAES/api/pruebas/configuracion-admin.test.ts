// HU-51.1: contrato HTTP y reglas de cambio de los parametros de la consola, sin base real.
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { crearAdministracionServicio } from '../modulos/administracion/index.js';
import type {
  ConfiguracionRepositorio,
  FilaConfiguracion,
} from '../modulos/administracion/administracion.configuracion.repositorio.js';
import type { Ejecutor, UnidadDeTrabajo } from '../db/transaccion.js';
import { crearAppDePrueba, tokenAdmin, tokenApp } from './ayudantes.js';

const RUTA = '/api/v1/admin/administracion/configuracion';
const FECHA = new Date('2026-11-12T12:00:00.000Z');

function escenario() {
  const filas = new Map<string, FilaConfiguracion>([
    [
      'cupo_inicial',
      {
        clave: 'cupo_inicial',
        valor: 10,
        descripcion: 'Cupo inicial.',
        actualizadoEn: FECHA,
        actualizadoPor: null,
      },
    ],
    [
      'modelo_ia',
      {
        clave: 'modelo_ia',
        valor: 'modelo-de-prueba',
        descripcion: 'Modelo.',
        actualizadoEn: FECHA,
        actualizadoPor: null,
      },
    ],
    [
      'tope_mensual_ia_usd',
      {
        clave: 'tope_mensual_ia_usd',
        valor: 10,
        descripcion: 'Gasto mensual.',
        actualizadoEn: FECHA,
        actualizadoPor: null,
      },
    ],
    [
      'umbral_eje_debil',
      {
        clave: 'umbral_eje_debil',
        valor: 60,
        descripcion: 'Acierto ponderado.',
        actualizadoEn: FECHA,
        actualizadoPor: null,
      },
    ],
  ]);
  const auditoria = vi.fn<(...argumentos: unknown[]) => Promise<void>>().mockResolvedValue();
  const tx: Ejecutor = { query: () => Promise.reject(new Error('No se usa SQL en esta prueba.')) };
  const unidadDeTrabajo: UnidadDeTrabajo = { enTransaccion: (trabajo) => trabajo(tx) };
  const repositorio: ConfiguracionRepositorio = {
    listar: () => Promise.resolve([...filas.values()]),
    buscar: (clave) => Promise.resolve(filas.get(clave) ?? null),
    actualizar: (clave, valor, _autorId) => {
      const actual = filas.get(clave);
      if (!actual) return Promise.reject(new Error('Falta la fila.'));
      const nueva = {
        ...actual,
        valor,
        actualizadoEn: new Date(FECHA.getTime() + 1),
        actualizadoPor: 'Admin',
      };
      filas.set(clave, nueva);
      return Promise.resolve(nueva);
    },
  };
  const servicio = crearAdministracionServicio({
    bd: tx,
    unidadDeTrabajo,
    repositorioConfiguracion: repositorio,
    revocarSesionesUsuarioInterno: () => Promise.resolve(),
    registrarCambioConfiguracion: auditoria,
  });
  return { app: crearAppDePrueba({}, { administracion: servicio }), filas, auditoria };
}

async function admin() {
  return { Authorization: `Bearer ${await tokenAdmin('admin', '7')}` };
}

describe('configuración del sistema (HU-51.1)', () => {
  it('lista los valores con su formato y metadatos solo para el administrador', async () => {
    const { app } = escenario();
    const respuesta = await request(app)
      .get(RUTA)
      .set(await admin());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      error: null,
      meta: null,
      data: {
        parametros: expect.arrayContaining([
          expect.objectContaining({
            clave: 'cupo_inicial',
            valor: 10,
            editable: true,
            unidad: 'preguntas',
          }),
          expect.objectContaining({ clave: 'modelo_ia', editable: false }),
        ]),
      },
    });
    expect(respuesta.body.data.parametros).toHaveLength(4);
  });

  it('rechaza a docente y token de la app', async () => {
    const { app } = escenario();
    const docente = { Authorization: `Bearer ${await tokenAdmin('docente', '8')}` };
    const estudiante = { Authorization: `Bearer ${await tokenApp()}` };
    expect((await request(app).get(RUTA).set(docente)).status).toBe(403);
    expect((await request(app).get(RUTA).set(estudiante)).status).toBe(401);
    expect(
      (
        await request(app)
          .patch(`${RUTA}/cupo_inicial`)
          .set(docente)
          .send({ valor: 12, actualizadoEn: FECHA.toISOString() })
      ).status,
    ).toBe(403);
  });

  it.each([
    [{ valor: '12', actualizadoEn: FECHA.toISOString() }],
    [{ valor: 0, actualizadoEn: FECHA.toISOString() }],
    [{ valor: 2.5, actualizadoEn: FECHA.toISOString() }],
    [{}],
  ])('rechaza un valor o cuerpo inválido con 400', async (cuerpo) => {
    const { app, auditoria } = escenario();
    const respuesta = await request(app)
      .patch(`${RUTA}/cupo_inicial`)
      .set(await admin())
      .send(cuerpo);
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
    expect(auditoria).not.toHaveBeenCalled();
  });

  it('rechaza una clave inexistente y una de solo lectura', async () => {
    const { app, auditoria } = escenario();
    const cuerpo = { valor: 12, actualizadoEn: FECHA.toISOString() };
    const noExiste = await request(app)
      .patch(`${RUTA}/ausente`)
      .set(await admin())
      .send(cuerpo);
    const soloLectura = await request(app)
      .patch(`${RUTA}/modelo_ia`)
      .set(await admin())
      .send(cuerpo);
    expect(noExiste.body.error.codigo).toBe('NO_ENCONTRADO');
    expect(soloLectura.body.error.codigo).toBe('VALIDACION');
    expect(auditoria).not.toHaveBeenCalled();
  });

  it.each([
    ['tope_mensual_ia_usd', 10.123],
    ['tope_mensual_ia_usd', -1],
    ['umbral_eje_debil', 101],
    ['umbral_eje_debil', -1],
  ])('rechaza %s con valor %s fuera de regla', async (clave, valor) => {
    const { app, auditoria } = escenario();
    const respuesta = await request(app)
      .patch(`${RUTA}/${clave}`)
      .set(await admin())
      .send({ valor, actualizadoEn: FECHA.toISOString() });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
    expect(auditoria).not.toHaveBeenCalled();
  });

  it('acepta un tope monetario con dos decimales', async () => {
    const { app } = escenario();
    const respuesta = await request(app)
      .patch(`${RUTA}/tope_mensual_ia_usd`)
      .set(await admin())
      .send({ valor: 10.25, actualizadoEn: FECHA.toISOString() });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.valor).toBe(10.25);
  });

  it('rechaza una fecha antigua y guarda con auditoría si coincide', async () => {
    const { app, auditoria, filas } = escenario();
    const primera = await request(app)
      .patch(`${RUTA}/cupo_inicial`)
      .set(await admin())
      .send({ valor: 12, actualizadoEn: FECHA.toISOString() });
    expect(primera.status).toBe(200);
    expect(primera.body.data.valor).toBe(12);
    expect(filas.get('cupo_inicial')?.valor).toBe(12);
    expect(auditoria).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'cambiar_configuracion',
        entidad: 'configuracion',
        entidadId: 'cupo_inicial',
        antes: { clave: 'cupo_inicial', valor: 10 },
        despues: { clave: 'cupo_inicial', valor: 12 },
      }),
      expect.anything(),
    );
    const antigua = await request(app)
      .patch(`${RUTA}/cupo_inicial`)
      .set(await admin())
      .send({ valor: 13, actualizadoEn: FECHA.toISOString() });
    expect(antigua.status).toBe(409);
    expect(antigua.body.error.codigo).toBe('CONFLICTO');
    expect(auditoria).toHaveBeenCalledTimes(1);
  });
});
