// Bandeja de calibración del docente por HTTP (D04, HU-26.1, RN-15), sin PostgreSQL: el servicio real de
// revision con las estadísticas de evaluaciones y el repositorio de calibración falsos. Lo que guarda la
// base, el área y la auditoría están en revision-calibracion-bd.test.ts.
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { CalibracionRepositorio } from '../modulos/revision/revision.calibracion.repositorio.js';
import { tokenAdmin } from './ayudantes.js';
import { AHORA, appDeRevision, comoDocente } from './bandeja-de-prueba.js';

const RUTA = '/api/v1/admin/revision/calibracion';

const FUERA_DE_RANGO = {
  preguntaId: '7',
  version: 2,
  intentos: 40,
  aciertos: 8,
  porcentajeAcierto: 20,
  tiempoPromedioSeg: 55,
  dificultad: {
    id: 1,
    codigo: 'facil',
    nombre: 'Fácil',
    aciertoEsperadoMin: 70,
    aciertoEsperadoMax: 100,
  },
};

const DIFICULTAD = {
  codigo: 'facil',
  nombre: 'Fácil',
  aciertoEsperadoMin: 70,
  aciertoEsperadoMax: 100,
};

const PREGUNTA = {
  preguntaId: '7',
  enunciado: 'Enunciado de prueba',
  prueba: 'Historia y Ciencias Sociales',
  contenido: 'Contenido de prueba',
  confirmaciones: 0,
  descartes: 0,
};

function escenario({ pendiente = true, yaDecidio = false, guarda = true } = {}) {
  const repositorio = {
    pendientesDelDocente: vi.fn(() => Promise.resolve(pendiente ? [PREGUNTA] : [])),
    yaDecidio: vi.fn(() => Promise.resolve(yaDecidio)),
    guardarDecision: vi.fn(() => Promise.resolve(guarda)),
    confirmadas: vi.fn(() =>
      Promise.resolve([
        {
          ...PREGUNTA,
          confirmaciones: 1,
          dificultad: DIFICULTAD,
          confirmadaEn: AHORA,
        },
      ]),
    ),
  } satisfies CalibracionRepositorio;
  const estadisticasFueraDeRango = vi.fn(() => Promise.resolve([FUERA_DE_RANGO]));
  const registrarAuditoria = vi.fn(() => Promise.resolve());
  const { app } = appDeRevision({
    repositorioCalibracion: repositorio,
    evaluaciones: {
      estadisticasFueraDeRango,
      estadisticasDe: () =>
        Promise.resolve([
          {
            preguntaId: '7',
            intentos: 41,
            aciertos: 8,
            porcentajeAcierto: 19.5,
            tiempoPromedioSeg: 55,
            actualizadoEn: AHORA,
          },
        ]),
    },
    administracion: { obtenerParametroEntero: () => Promise.resolve(2), registrarAuditoria },
  });
  return { app, repositorio, estadisticasFueraDeRango, registrarAuditoria };
}

const decidir = async (app: ReturnType<typeof escenario>['app'], cuerpo: unknown, id = '7') =>
  request(app)
    .post(`${RUTA}/${id}`)
    .set(await comoDocente())
    .send(cuerpo as object);

describe('bandeja de calibración (HU-26 esc. 1, RN-15)', () => {
  it('lista las preguntas de su área fuera de rango, con su dificultad, rango y estadísticas', async () => {
    const { app, repositorio, estadisticasFueraDeRango } = escenario();

    const respuesta = await request(app)
      .get(RUTA)
      .set(await comoDocente());

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual([
      {
        ...PREGUNTA,
        dificultad: {
          codigo: 'facil',
          nombre: 'Fácil',
          aciertoEsperadoMin: 70,
          aciertoEsperadoMax: 100,
        },
        intentos: 40,
        aciertos: 8,
        porcentajeAcierto: 20,
        tiempoPromedioSeg: 55,
      },
    ]);
    expect(respuesta.body.meta).toEqual({ total: 1 });
    expect(estadisticasFueraDeRango).toHaveBeenCalledWith(30);
    expect(repositorio.pendientesDelDocente).toHaveBeenCalledWith('21', [
      { preguntaId: '7', version: 2, dificultadId: 1 },
    ]);
  });

  it('el administrador no entra a la bandeja ni decide (403)', async () => {
    const { app } = escenario();
    const admin = { Authorization: `Bearer ${await tokenAdmin('admin', '5')}` };

    expect((await request(app).get(RUTA).set(admin)).status).toBe(403);
    expect(
      (await request(app).post(`${RUTA}/7`).set(admin).send({ dificultadCorresponde: false }))
        .status,
    ).toBe(403);
  });
});

describe('decisión del docente (HU-26.1)', () => {
  it('confirma que la dificultad no corresponde: la guarda con lo que vio y la audita', async () => {
    const { app, repositorio, registrarAuditoria } = escenario();

    const respuesta = await decidir(app, { dificultadCorresponde: false });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toEqual({
      preguntaId: '7',
      dificultadCorresponde: false,
      creadoEn: AHORA.toISOString(),
    });
    expect(repositorio.guardarDecision).toHaveBeenCalledWith(
      {
        preguntaId: '7',
        version: 2,
        dificultadId: 1,
        docenteId: '21',
        dificultadCorresponde: false,
        intentos: 40,
        aciertos: 8,
        creadoEn: AHORA,
      },
      expect.anything(),
    );
    expect(registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: '21',
        accion: 'confirmar_calibracion',
        entidad: 'pregunta',
        entidadId: '7',
        antes: null,
      }),
      expect.anything(),
    );
  });

  it('descartar queda como descartar_calibracion', async () => {
    const { app, registrarAuditoria } = escenario();

    expect((await decidir(app, { dificultadCorresponde: true })).status).toBe(201);
    expect(registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'descartar_calibracion' }),
      expect.anything(),
    );
  });

  it('sin indicar si corresponde, 400', async () => {
    const { app, repositorio } = escenario();

    expect((await decidir(app, {})).status).toBe(400);
    expect((await decidir(app, { dificultadCorresponde: 'no' })).status).toBe(400);
    expect(repositorio.guardarDecision).not.toHaveBeenCalled();
  });

  it('una pregunta que no salió de su rango no está en la bandeja (404)', async () => {
    const { app, repositorio } = escenario();

    expect((await decidir(app, { dificultadCorresponde: false }, '8')).status).toBe(404);
    expect(repositorio.guardarDecision).not.toHaveBeenCalled();
  });

  it('una pregunta de otra área, 404 sin guardar ni auditar', async () => {
    const { app, repositorio, registrarAuditoria } = escenario({ pendiente: false });

    expect((await decidir(app, { dificultadCorresponde: false })).status).toBe(404);
    expect(repositorio.guardarDecision).not.toHaveBeenCalled();
    expect(registrarAuditoria).not.toHaveBeenCalled();
  });

  it('si ya decidió esa versión y dificultad, 409', async () => {
    const { app, registrarAuditoria } = escenario({ pendiente: false, yaDecidio: true });

    expect((await decidir(app, { dificultadCorresponde: true })).status).toBe(409);
    expect(registrarAuditoria).not.toHaveBeenCalled();
  });

  it('si otra petición igual guardó antes, 409 sin auditar', async () => {
    const { app, registrarAuditoria } = escenario({ guarda: false });

    expect((await decidir(app, { dificultadCorresponde: false })).status).toBe(409);
    expect(registrarAuditoria).not.toHaveBeenCalled();
  });
});

describe('confirmadas para el administrador (HU-26.2)', () => {
  const RUTA_CONFIRMADAS = `${RUTA}/confirmadas`;

  it('lista las confirmadas con sus estadísticas actuales', async () => {
    const { app } = escenario();

    const respuesta = await request(app)
      .get(RUTA_CONFIRMADAS)
      .set({ Authorization: `Bearer ${await tokenAdmin('admin', '5')}` });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual([
      {
        ...PREGUNTA,
        confirmaciones: 1,
        dificultad: DIFICULTAD,
        confirmadaEn: AHORA.toISOString(),
        intentos: 41,
        aciertos: 8,
        porcentajeAcierto: 19.5,
        tiempoPromedioSeg: 55,
      },
    ]);
    expect(respuesta.body.meta).toEqual({ total: 1 });
  });

  it('el docente no ve las confirmadas (403)', async () => {
    const { app } = escenario();

    expect(
      (
        await request(app)
          .get(RUTA_CONFIRMADAS)
          .set(await comoDocente())
      ).status,
    ).toBe(403);
  });
});
