// Clasificar dificultad del banco semilla por HTTP (HU-25.1, CU-19a, RF-G12, D03), sin PostgreSQL: el
// servicio real de revision con repositorios falsos. La clasificación rápida es la revisión del revisor
// asignado (opción a del plan): un clic entrega la revisión con esa dificultad, la decisión «aprobar» y
// toda la pauta cumplida, y la ronda sigue RN-11. Lo que guarda la base, el orden de la bandeja y la
// combinación de las revisiones están en revision-clasificacion-bd.test.ts.
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { ClasificacionRepositorio } from '../modulos/revision/revision.clasificacion.repositorio.js';
import { errorConFormato, tokenAdmin, tokenApp } from './ayudantes.js';
import { appDeRevision, bandejaDePrueba, comoDocente, PAUTA } from './bandeja-de-prueba.js';

const RUTA = '/api/v1/admin/revision/clasificar';

/** La asignación 900 de una pregunta importada, como la devuelve la consulta. */
const FILA = {
  id: '900',
  preguntaId: '7',
  ronda: 1,
  prueba: { codigo: 'M1', nombre: 'Competencia Matemática 1' },
  contenido: 'Medidas de posición',
  venceEn: new Date('2026-11-05T12:00:00.000Z'),
  eje: 'Probabilidad y estadística',
  habilidad: 'Resolver problemas',
  copia: {
    enunciado: '¿Cuál es la mediana de 1, 3 y 8?',
    explicacion: 'El valor central es 3.',
    alternativas: [
      { id: 101, letra: 'A', texto: '1', explicacion: null },
      { id: 102, letra: 'B', texto: '3', explicacion: null },
    ],
  },
  correctaId: '102',
  texto: null,
};

/**
 * Bandeja de clasificación; `quedan` es la cantidad pendiente y `estado` el de la asignación al
 * clasificarla (null si no es del docente o su pregunta no es importada).
 */
function clasificacionDePrueba({
  quedan = 1,
  estado = 'pendiente',
}: { quedan?: number; estado?: string | null } = {}) {
  return {
    siguiente: vi.fn(() => Promise.resolve(quedan > 0 ? FILA : null)),
    contarPendientes: vi.fn(() => Promise.resolve(quedan)),
    reservarAsignacion: vi.fn(() =>
      Promise.resolve(estado === null ? null : { estado, preguntaId: '7' }),
    ),
  } satisfies ClasificacionRepositorio;
}

function escenario(opciones: { quedan?: number; estado?: string | null } = {}) {
  const repositorio = clasificacionDePrueba(opciones);
  const bandeja = bandejaDePrueba();
  const resolverRevision = vi.fn(() => Promise.resolve());
  const { app } = appDeRevision({
    repositorioBandeja: bandeja,
    repositorioClasificacion: repositorio,
    // La ronda sigue abierta: combinar las revisiones se prueba con PostgreSQL.
    repositorioResolucion: {
      reservarPregunta: () => Promise.resolve(),
      asignacionesDeLaRonda: () => Promise.resolve([]),
    },
    preguntas: {
      pasarARevision: () => Promise.reject(new Error('no se usa')),
      resolverRevision,
    },
  });
  return { app, repositorio, bandeja };
}

describe('siguiente pregunta por clasificar (HU-25 esc. 1, D03)', () => {
  it('entrega la pregunta importada con la correcta, las dificultades y las que quedan, a ciegas', async () => {
    const { app, repositorio } = escenario({ quedan: 12 });

    const respuesta = await request(app)
      .get(`${RUTA}/siguiente`)
      .set(await comoDocente());

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({
      quedan: 12,
      pregunta: {
        id: 900,
        preguntaId: 7,
        ronda: 1,
        prueba: { codigo: 'M1', nombre: 'Competencia Matemática 1' },
        eje: 'Probabilidad y estadística',
        contenido: 'Medidas de posición',
        habilidad: 'Resolver problemas',
        venceEn: '2026-11-05T12:00:00.000Z',
        enunciado: '¿Cuál es la mediana de 1, 3 y 8?',
        explicacion: 'El valor central es 3.',
        alternativas: [
          { id: 101, letra: 'A', texto: '1', explicacion: null, esCorrecta: false },
          { id: 102, letra: 'B', texto: '3', explicacion: null, esCorrecta: true },
        ],
        texto: null,
        dificultades: [
          { codigo: 'facil', nombre: 'Fácil' },
          { codigo: 'media', nombre: 'Media' },
          { codigo: 'dificil', nombre: 'Difícil' },
        ],
      },
    });
    expect(JSON.stringify(respuesta.body)).not.toMatch(/sugerida/i);
    expect(repositorio.siguiente).toHaveBeenCalledWith('21', null);
    expect(repositorio.contarPendientes).toHaveBeenCalledWith('21');
  });

  it('saltar pide la siguiente después de la asignación indicada', async () => {
    const { app, repositorio } = escenario();

    const respuesta = await request(app)
      .get(`${RUTA}/siguiente?despuesDe=900`)
      .set(await comoDocente());

    expect(respuesta.status).toBe(200);
    expect(repositorio.siguiente).toHaveBeenCalledWith('21', '900');
  });

  it('sin preguntas por clasificar responde la pregunta vacía y cero', async () => {
    const { app } = escenario({ quedan: 0 });

    const respuesta = await request(app)
      .get(`${RUTA}/siguiente`)
      .set(await comoDocente());

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({ pregunta: null, quedan: 0 });
  });

  it('rechaza un despuesDe que no es un id', async () => {
    const { app } = escenario();

    const respuesta = await request(app)
      .get(`${RUTA}/siguiente?despuesDe=abc`)
      .set(await comoDocente());

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toMatchObject(errorConFormato('VALIDACION'));
  });

  it('el administrador no clasifica (403) y el token de la app no sirve (401)', async () => {
    const { app } = escenario();

    const comoAdmin = await request(app)
      .get(`${RUTA}/siguiente`)
      .set({ Authorization: `Bearer ${await tokenAdmin('admin', '5')}` });
    const conLaApp = await request(app)
      .get(`${RUTA}/siguiente`)
      .set({ Authorization: `Bearer ${await tokenApp()}` });

    expect(comoAdmin.status).toBe(403);
    expect(conLaApp.status).toBe(401);
  });
});

describe('clasificar con un clic (HU-25 esc. 1, CU-19a)', () => {
  it('entrega la revisión con la dificultad, la decisión aprobar y la pauta cumplida, y devuelve la siguiente', async () => {
    const { app, bandeja, repositorio } = escenario({ quedan: 3 });

    const respuesta = await request(app)
      .post(`${RUTA}/900`)
      .set(await comoDocente())
      .send({ dificultad: 'media' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      guardada: { asignacionId: 900, preguntaId: 7, dificultad: 'media' },
      siguiente: { quedan: 3, pregunta: { id: 900 } },
    });
    expect(repositorio.reservarAsignacion).toHaveBeenCalledWith('900', '21', expect.anything());
    expect(bandeja.reservarAsignacion).not.toHaveBeenCalled();
    expect(bandeja.guardarRevision).toHaveBeenCalledWith(
      {
        asignacionId: '900',
        decision: 'aprobar',
        dificultad: 'media',
        comentario: null,
        criterios: PAUTA.map(({ codigo }) => ({ codigo, cumple: true, observacion: null })),
        entregadaEn: new Date('2026-11-03T15:00:00.000Z'),
      },
      expect.anything(),
    );
    expect(repositorio.siguiente).toHaveBeenCalledWith('21', '900');
  });

  it('rechaza una dificultad que no existe sin guardar nada', async () => {
    const { app, bandeja } = escenario();

    const respuesta = await request(app)
      .post(`${RUTA}/900`)
      .set(await comoDocente())
      .send({ dificultad: 'muy_dificil' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toMatchObject(errorConFormato('VALIDACION'));
    expect(bandeja.guardarRevision).not.toHaveBeenCalled();
  });

  it('rechaza un cuerpo sin dificultad o con campos de más', async () => {
    const { app } = escenario();
    const docente = await comoDocente();

    const sinDificultad = await request(app).post(`${RUTA}/900`).set(docente).send({});
    const conDecision = await request(app)
      .post(`${RUTA}/900`)
      .set(docente)
      .send({ dificultad: 'facil', decision: 'rechazar' });

    expect(sinDificultad.status).toBe(400);
    expect(conDecision.status).toBe(400);
  });

  it('una asignación de otro docente o de una pregunta no importada no existe (404)', async () => {
    const { app, bandeja } = escenario({ estado: null });

    const respuesta = await request(app)
      .post(`${RUTA}/900`)
      .set(await comoDocente())
      .send({ dificultad: 'facil' });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual(errorConFormato('NO_ENCONTRADO'));
    expect(bandeja.guardarRevision).not.toHaveBeenCalled();
  });

  it('una pregunta ya clasificada no se clasifica de nuevo (409)', async () => {
    const { app, bandeja } = escenario({ estado: 'completada' });

    const respuesta = await request(app)
      .post(`${RUTA}/900`)
      .set(await comoDocente())
      .send({ dificultad: 'facil' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual(errorConFormato('CONFLICTO'));
    expect(bandeja.guardarRevision).not.toHaveBeenCalled();
  });

  it('el administrador no clasifica (403)', async () => {
    const { app } = escenario();

    const respuesta = await request(app)
      .post(`${RUTA}/900`)
      .set({ Authorization: `Bearer ${await tokenAdmin('admin', '5')}` })
      .send({ dificultad: 'facil' });

    expect(respuesta.status).toBe(403);
  });
});
