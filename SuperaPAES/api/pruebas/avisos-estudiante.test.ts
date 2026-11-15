// Avisos de error del estudiante (HU-37, RF-A16, CU-13, A23) sin PostgreSQL: el contrato HTTP con los
// servicios reemplazados y las reglas de los dos servicios con repositorios en memoria. El guardado
// real, el candado y la versión que vio el estudiante están en avisos-estudiante-bd.test.ts.
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { crearServicios } from '../app.js';
import type { Ejecutor } from '../db/transaccion.js';
import { crearAvisosServicio } from '../modulos/evaluaciones/evaluaciones.avisos.servicio.js';
import type { AvisosAppRepositorio } from '../modulos/preguntas/preguntas.avisos-app.repositorio.js';
import { crearAvisosDeEstudiantes } from '../modulos/preguntas/preguntas.avisos-app.servicio.js';
import { crearAppDePrueba, crearDependenciasDePrueba, tokenApp } from './ayudantes.js';

const MOTIVO = { codigo: 'respuesta', nombre: 'La respuesta correcta está mal' };
const PENDIENTE = { codigo: 'pendiente', nombre: 'Pendiente' };
const GUARDADO = {
  id: '41',
  motivo: MOTIVO,
  estado: PENDIENTE,
  creadoEn: '2026-11-15T13:00:00.000Z',
};
const RUTA = '/api/v1/app/evaluaciones/7/items/70/avisos';
const tx = { query: vi.fn() } as unknown as Ejecutor;

function appConAvisos() {
  const reales = crearServicios(crearDependenciasDePrueba());
  const avisarError = vi.fn(() => Promise.resolve(GUARDADO));
  const motivosDeAvisoApp = vi.fn(() => Promise.resolve([MOTIVO]));
  const app = crearAppDePrueba(
    {},
    {
      preguntas: { ...reales.preguntas, motivosDeAvisoApp },
      evaluaciones: { ...reales.evaluaciones, avisarError },
    },
  );
  return { app, avisarError, motivosDeAvisoApp };
}

describe('avisar un error por HTTP (HU-37)', () => {
  it('entrega los motivos de la lista a la app', async () => {
    const { app } = appConAvisos();
    const respuesta = await request(app)
      .get('/api/v1/app/preguntas/avisos/motivos')
      .set('Authorization', `Bearer ${await tokenApp()}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ data: [MOTIVO], error: null, meta: null });
  });

  it('responde 201 con el aviso guardado y pasa el comentario sin espacios en los extremos', async () => {
    const { app, avisarError } = appConAvisos();
    const respuesta = await request(app)
      .post(RUTA)
      .set('Authorization', `Bearer ${await tokenApp('10')}`)
      .send({ motivo: 'respuesta', comentario: '  La correcta es la C.  ' });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toEqual(GUARDADO);
    expect(avisarError).toHaveBeenCalledWith('10', {
      evaluacionId: '7',
      itemId: '70',
      motivo: 'respuesta',
      comentario: 'La correcta es la C.',
    });
  });

  it.each([
    ['sin comentario', { motivo: 'respuesta' }],
    ['comentario corto', { motivo: 'respuesta', comentario: ' mal ' }],
    ['comentario largo', { motivo: 'respuesta', comentario: 'a'.repeat(501) }],
    ['sin motivo', { comentario: 'La correcta es la C.' }],
    ['con la versión en el cuerpo', { motivo: 'otro', comentario: 'Algo falla.', version: 1 }],
  ])('rechaza el cuerpo %s con 400 sin llamar al servicio', async (_caso, cuerpo) => {
    const { app, avisarError } = appConAvisos();
    const respuesta = await request(app)
      .post(RUTA)
      .set('Authorization', `Bearer ${await tokenApp()}`)
      .send(cuerpo);
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
    expect(avisarError).not.toHaveBeenCalled();
  });

  it('exige la sesión de la app', async () => {
    const { app } = appConAvisos();
    const respuesta = await request(app).post(RUTA).send({ motivo: 'otro', comentario: 'Algo.' });
    expect(respuesta.status).toBe(401);
  });
});

function repositorioEnMemoria(cambios: Partial<AvisosAppRepositorio> = {}) {
  return {
    motivosActivos: vi.fn(() => Promise.resolve([MOTIVO])),
    bloquearEstudiante: vi.fn(() => Promise.resolve()),
    tienePendiente: vi.fn(() => Promise.resolve(false)),
    contarRecientes: vi.fn(() => Promise.resolve(0)),
    insertar: vi.fn(() =>
      Promise.resolve({ ...GUARDADO, creadoEn: new Date('2026-11-15T13:00:00Z') }),
    ),
    ...cambios,
  } satisfies AvisosAppRepositorio;
}

const AVISO = {
  estudianteId: '10',
  preguntaId: '205',
  version: 2,
  motivo: 'respuesta',
  comentario: 'La correcta es la C.',
};

describe('reglas del aviso en preguntas (HU-37, D4)', () => {
  it('bloquea al estudiante antes de revisar los límites y guarda el aviso', async () => {
    const repositorio = repositorioEnMemoria();
    const servicio = crearAvisosDeEstudiantes({ bd: tx, repositorioAvisosApp: repositorio });
    expect(await servicio.registrarAvisoDeEstudiante(AVISO, tx)).toEqual(GUARDADO);
    expect(repositorio.bloquearEstudiante).toHaveBeenCalledWith('10', tx);
    expect(repositorio.insertar).toHaveBeenCalledWith(AVISO, tx);
  });

  it('409 si ya tiene un aviso pendiente de esa pregunta', async () => {
    const repositorio = repositorioEnMemoria({ tienePendiente: () => Promise.resolve(true) });
    const servicio = crearAvisosDeEstudiantes({ bd: tx, repositorioAvisosApp: repositorio });
    await expect(servicio.registrarAvisoDeEstudiante(AVISO, tx)).rejects.toMatchObject({
      estadoHttp: 409,
      codigo: 'CONFLICTO',
    });
    expect(repositorio.insertar).not.toHaveBeenCalled();
  });

  it('429 al llegar a 10 avisos en 24 horas', async () => {
    const repositorio = repositorioEnMemoria({ contarRecientes: () => Promise.resolve(10) });
    const servicio = crearAvisosDeEstudiantes({ bd: tx, repositorioAvisosApp: repositorio });
    await expect(servicio.registrarAvisoDeEstudiante(AVISO, tx)).rejects.toMatchObject({
      estadoHttp: 429,
    });
  });

  it('400 si el motivo no existe o no está activo', async () => {
    const repositorio = repositorioEnMemoria({ insertar: () => Promise.resolve(null) });
    const servicio = crearAvisosDeEstudiantes({ bd: tx, repositorioAvisosApp: repositorio });
    await expect(servicio.registrarAvisoDeEstudiante(AVISO, tx)).rejects.toMatchObject({
      estadoHttp: 400,
      codigo: 'VALIDACION',
    });
  });
});

describe('el ítem del aviso en evaluaciones (HU-37, D1 a D3)', () => {
  const unidadDeTrabajo = {
    enTransaccion: <T>(trabajo: (ejecutor: Ejecutor) => Promise<T>) => trabajo(tx),
  };
  const datos = { evaluacionId: '7', itemId: '70', motivo: 'respuesta', comentario: 'Mal.' };

  function servicioCon(item: { preguntaId: string; version: number; anulada: boolean } | null) {
    const preguntas = { registrarAvisoDeEstudiante: vi.fn(() => Promise.resolve(GUARDADO)) };
    const repositorio = { itemDelEstudiante: vi.fn(() => Promise.resolve(item)) };
    return {
      servicio: crearAvisosServicio({ unidadDeTrabajo, preguntas, repositorio }),
      preguntas,
    };
  }

  it('guarda el aviso con la pregunta y la versión del ítem', async () => {
    const { servicio, preguntas } = servicioCon({ preguntaId: '205', version: 2, anulada: false });
    expect(await servicio.avisarError('10', datos)).toEqual(GUARDADO);
    expect(preguntas.registrarAvisoDeEstudiante).toHaveBeenCalledWith(
      {
        estudianteId: '10',
        preguntaId: '205',
        version: 2,
        motivo: 'respuesta',
        comentario: 'Mal.',
      },
      tx,
    );
  });

  it('404 si el ítem no es de una evaluación del estudiante', async () => {
    const { servicio, preguntas } = servicioCon(null);
    await expect(servicio.avisarError('10', datos)).rejects.toMatchObject({ estadoHttp: 404 });
    expect(preguntas.registrarAvisoDeEstudiante).not.toHaveBeenCalled();
  });

  it('409 si la pregunta ya se anuló en esa evaluación', async () => {
    const { servicio } = servicioCon({ preguntaId: '205', version: 2, anulada: true });
    await expect(servicio.avisarError('10', datos)).rejects.toMatchObject({ estadoHttp: 409 });
  });
});
