// Desempates del tercer docente por HTTP (D02, HU-23, CU-20, RF-G08, RN-11 y RN-12), sin PostgreSQL: el
// servicio real de revision con la bandeja de desempates y las revisiones de la ronda falsas. Lo que
// guarda la base está en revision-resolucion-bd.test.ts.
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { RevisionDelRevisor } from '../modulos/revision/revision.desempate.repositorio.js';
import { errorConFormato } from './ayudantes.js';
import {
  AHORA,
  appDeRevision,
  bandejaDePrueba,
  comoDocente,
  PAUTA,
  VENCE,
} from './bandeja-de-prueba.js';
import { problemas } from './edicion-de-prueba.js';

const RUTA = '/api/v1/admin/revision/desempates';

const revisionDe = (
  decision: [string, string],
  dificultad: [string, string],
  comentario: string | null,
): RevisionDelRevisor => ({
  decision: { codigo: decision[0], nombre: decision[1] },
  dificultad: { codigo: dificultad[0], nombre: dificultad[1] },
  comentario,
  criterios: PAUTA.map((criterio, i) => ({
    ...criterio,
    cumple: i > 0,
    observacion: i > 0 ? null : 'No evalúa el contenido del temario.',
  })),
});

/** Una aprobó como fácil y la otra rechazó como difícil: posiblemente confusa. */
const REVISIONES = [
  revisionDe(['aprobar', 'Aprobar'], ['facil', 'Fácil'], null),
  revisionDe(['rechazar', 'Rechazar'], ['dificil', 'Difícil'], 'La respuesta no es única.'),
];

/** Desempate de la bandeja; `estado` es el de su asignación al entregarlo (null si no es del docente). */
function escenario({ estado = 'pendiente' }: { estado?: string | null } = {}) {
  const repositorio = bandejaDePrueba(estado);
  const resolverRevision = vi.fn(() => Promise.resolve());
  const { app, tx } = appDeRevision({
    preguntas: { pasarARevision: () => Promise.reject(new Error('no se usa')), resolverRevision },
    repositorioDesempates: repositorio,
    repositorioRevisiones: { revisionesDeLaRonda: vi.fn(() => Promise.resolve(REVISIONES)) },
  });
  return { app, repositorio, resolverRevision, tx };
}

interface DesempateRecibido {
  alternativas: { letra: string; esCorrecta: boolean }[];
  revisiones: unknown;
  posibleAmbigua: boolean;
}

describe('desempates del tercer docente (HU-23 esc. 3, CU-20)', () => {
  it('lista sus desempates pendientes', async () => {
    const { app, repositorio } = escenario();

    const { body } = await request(app)
      .get(RUTA)
      .set(await comoDocente())
      .expect(200);

    expect(body).toMatchObject({
      data: [{ id: 900, preguntaId: 7, venceEn: VENCE.toISOString() }],
    });
    expect(repositorio.listarPendientes).toHaveBeenCalledWith('21');
  });

  it('muestra la pregunta con las dos revisiones, sin quién las escribió, y avisa fácil contra difícil', async () => {
    const { app, repositorio } = escenario();

    const { body } = await request(app)
      .get(`${RUTA}/900`)
      .set(await comoDocente())
      .expect(200);
    const abierto = (body as { data: DesempateRecibido }).data;

    expect(abierto.revisiones).toEqual(REVISIONES);
    expect(abierto.posibleAmbigua).toBe(true);
    expect(abierto.alternativas.filter((a) => a.esCorrecta).map((a) => a.letra)).toEqual(['B']);
    expect(JSON.stringify(abierto)).not.toMatch(/docente|correo|sugerida/i);
    expect(repositorio.obtenerPendiente).toHaveBeenCalledWith('900', '21');
  });

  it('un desempate que no es suyo o ya entregó no existe para él (404)', async () => {
    const { app } = escenario();

    const respuesta = await request(app)
      .get(`${RUTA}/901`)
      .set(await comoDocente());

    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual(errorConFormato('NO_ENCONTRADO'));
    expect(respuesta.body.error.mensaje).toBe('El desempate no existe o ya lo entregaste.');
  });
});

describe('decidir el desempate (CU-20, RN-11)', () => {
  it('aprobar deja la pregunta aprobada con la dificultad final y responde 201', async () => {
    const { app, repositorio, resolverRevision, tx } = escenario();

    const respuesta = await request(app)
      .post(`${RUTA}/900`)
      .set(await comoDocente())
      .send({ dificultad: 'dificil', decision: 'aprobar' });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toEqual({
      asignacionId: 900,
      preguntaId: 7,
      decision: 'aprobar',
      dificultad: 'dificil',
      estado: 'aprobada',
    });
    expect(repositorio.guardarRevision).toHaveBeenCalledWith(
      {
        asignacionId: '900',
        dificultad: 'dificil',
        decision: 'aprobar',
        comentario: null,
        criterios: [],
        entregadaEn: AHORA,
      },
      tx,
    );
    expect(resolverRevision).toHaveBeenCalledWith(
      '21',
      '7',
      { estado: 'aprobada', dificultad: 'dificil', posibleAmbigua: null },
      tx,
    );
  });

  it('rechazar u observar exige el motivo y no asigna dificultad', async () => {
    const { app, resolverRevision } = escenario();
    const sinMotivo = await request(app)
      .post(`${RUTA}/900`)
      .set(await comoDocente())
      .send({ dificultad: 'media', decision: 'rechazar' });
    const conMotivo = await request(app)
      .post(`${RUTA}/900`)
      .set(await comoDocente())
      .send({ dificultad: 'media', decision: 'observar', comentario: 'Aclarar el enunciado.' });

    expect(sinMotivo.status).toBe(400);
    expect(problemas(sinMotivo)).toEqual([
      'comentario: Escribe el motivo para rechazar la pregunta.',
    ]);
    expect(conMotivo.status).toBe(201);
    expect(conMotivo.body.data.estado).toBe('observada');
    expect(resolverRevision).toHaveBeenCalledTimes(1);
    expect(resolverRevision).toHaveBeenCalledWith(
      '21',
      '7',
      { estado: 'observada', dificultad: null, posibleAmbigua: null },
      expect.anything(),
    );
  });

  it('no acepta una pauta ni opciones que no existen', async () => {
    const { app, repositorio } = escenario();

    const conPauta = await request(app)
      .post(`${RUTA}/900`)
      .set(await comoDocente())
      .send({ dificultad: 'media', decision: 'aprobar', criterios: [] });
    const inventadas = await request(app)
      .post(`${RUTA}/900`)
      .set(await comoDocente())
      .send({ dificultad: 'extrema', decision: 'dudar' });

    expect(conPauta.status).toBe(400);
    expect(problemas(inventadas)).toEqual([
      'dificultad: Elige la dificultad: fácil, media o difícil.',
      'decision: Elige si apruebas, observas o rechazas la pregunta.',
    ]);
    expect(repositorio.reservarAsignacion).not.toHaveBeenCalled();
  });

  it('un desempate ya entregado no se vuelve a entregar (409), y uno ajeno no existe (404)', async () => {
    const entregado = escenario({ estado: 'completada' });
    const ajeno = escenario({ estado: null });
    const cuerpo = { dificultad: 'media', decision: 'aprobar' };

    const otraVez = await request(entregado.app)
      .post(`${RUTA}/900`)
      .set(await comoDocente())
      .send(cuerpo);
    const deOtro = await request(ajeno.app)
      .post(`${RUTA}/900`)
      .set(await comoDocente())
      .send(cuerpo);

    expect(otraVez.status).toBe(409);
    expect(otraVez.body.error.mensaje).toBe('Este desempate ya se entregó.');
    expect(deOtro.status).toBe(404);
    expect(entregado.resolverRevision).not.toHaveBeenCalled();
    expect(ajeno.repositorio.guardarRevision).not.toHaveBeenCalled();
  });
});
