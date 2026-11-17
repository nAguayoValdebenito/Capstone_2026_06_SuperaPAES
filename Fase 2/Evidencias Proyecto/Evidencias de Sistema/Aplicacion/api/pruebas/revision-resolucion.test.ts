// Resolver la ronda de revisión (HU-23, CU-19 paso 7, RN-11 y RN-12, CP-16 pasos 1 y 2), sin
// PostgreSQL: las reglas que combinan las revisiones con todas las combinaciones de decisión y
// dificultad, y la resolución con repositorios falsos (cuándo se resuelve y la asignación del tercer
// docente). Contra la base: revision-resolucion-bd.test.ts.
import { describe, expect, it, vi } from 'vitest';
import { combinarRevisiones, etapaDelDesempate } from '../modulos/revision/revision.reglas.js';
import type { AsignacionDeLaRonda } from '../modulos/revision/revision.resolucion.repositorio.js';
import { resolverRonda } from '../modulos/revision/revision.resolucion.servicio.js';

const DECISIONES = ['aprobar', 'observar', 'rechazar'] as const;
const DIFICULTADES = ['facil', 'media', 'dificil'] as const;

describe('CP-16 paso 1: combinar las decisiones (RN-11)', () => {
  it.each([
    ['aprobar', 'aprobar', 'aprobada'],
    ['rechazar', 'rechazar', 'rechazada'],
    ['aprobar', 'observar', 'observada'],
    ['observar', 'rechazar', 'observada'],
    ['observar', 'observar', 'observada'],
    ['aprobar', 'rechazar', 'desempate'],
  ])('%s y %s, con la misma dificultad: %s', (primera, segunda, estado) => {
    const revisiones = [
      { decision: primera, dificultad: 'media' },
      { decision: segunda, dificultad: 'media' },
    ];

    expect(combinarRevisiones(revisiones).estado).toBe(estado);
    expect(combinarRevisiones([...revisiones].reverse()).estado).toBe(estado);
  });

  it('dos aprobaciones con la misma dificultad dejan esa dificultad', () => {
    expect(
      combinarRevisiones([
        { decision: 'aprobar', dificultad: 'dificil' },
        { decision: 'aprobar', dificultad: 'dificil' },
      ]),
    ).toEqual({ estado: 'aprobada', dificultad: 'dificil', posibleAmbigua: false });
  });
});

describe('CP-16 paso 2: combinar las dificultades (RN-11 y RN-12)', () => {
  const pares = DIFICULTADES.flatMap((a) => DIFICULTADES.map((b) => [a, b] as const));

  it.each(pares)('dos aprueban con %s y %s', (a, b) => {
    const resolucion = combinarRevisiones([
      { decision: 'aprobar', dificultad: a },
      { decision: 'aprobar', dificultad: b },
    ]);

    expect(resolucion.estado).toBe(a === b ? 'aprobada' : 'desempate');
    const facilYDificil = [a, b].includes('facil') && [a, b].includes('dificil');
    expect(resolucion.posibleAmbigua).toBe(facilYDificil);
  });

  it('fácil contra difícil marca la pregunta como posiblemente confusa con cualquier decisión', () => {
    for (const primera of DECISIONES) {
      for (const segunda of DECISIONES) {
        const resolucion = combinarRevisiones([
          { decision: primera, dificultad: 'facil' },
          { decision: segunda, dificultad: 'dificil' },
        ]);
        expect(resolucion.posibleAmbigua).toBe(true);
      }
    }
  });
});

describe('CU-20: la decisión del tercer docente es la final', () => {
  it.each([
    ['aprobar', 'aprobada'],
    ['rechazar', 'rechazada'],
    ['observar', 'observada'],
  ])('%s deja la pregunta %s', (decision, etapa) => {
    expect(etapaDelDesempate(decision)).toBe(etapa);
  });

  it('una decisión que no deja la pregunta en una etapa no tiene etapa', () => {
    expect(etapaDelDesempate('dudar')).toBeUndefined();
  });
});

const asignacion = (
  docenteId: string,
  cambios: Partial<AsignacionDeLaRonda> = {},
): AsignacionDeLaRonda => ({
  docenteId,
  rol: 'revisor',
  estado: 'completada',
  ronda: 2,
  version: 4,
  decision: 'aprobar',
  dificultad: 'media',
  ...cambios,
});

const PLAZO = {
  asignadoEn: new Date('2026-11-03T15:00:00.000Z'),
  venceEn: new Date('2026-11-06T15:00:00.000Z'),
};

/** La resolución con la ronda indicada y los docentes del área disponibles (ya ordenados por carga). */
function escenario(ronda: AsignacionDeLaRonda[], disponibles = ['21', '22', '23']) {
  const dependencias = {
    plazo: vi.fn(() => Promise.resolve(PLAZO)),
    preguntas: { resolverRevision: vi.fn(() => Promise.resolve()) },
    repositorio: {
      reservarPregunta: vi.fn(() => Promise.resolve()),
      asignacionesDeLaRonda: vi.fn(() => Promise.resolve(ronda)),
    },
    revisores: {
      reservarArea: vi.fn(() => Promise.resolve()),
      docentesDisponibles: vi.fn(() =>
        Promise.resolve(disponibles.map((id) => ({ id, nombre: id, correo: `${id}@x.cl` }))),
      ),
      asignarRevisores: vi.fn(() => Promise.resolve([])),
    },
  };
  const tx = { query: () => Promise.reject(new Error('sin base')) };
  const resolver = () => resolverRonda(dependencias, ['22', '84'], tx);
  return { dependencias, resolver, tx };
}

describe('resolver la ronda al entregar (HU-23.1 y HU-23.2)', () => {
  it('mientras falta un revisor no se resuelve', async () => {
    const { dependencias, resolver } = escenario([
      asignacion('21'),
      asignacion('22', { estado: 'pendiente', decision: null, dificultad: null }),
    ]);

    await resolver();

    expect(dependencias.repositorio.reservarPregunta).toHaveBeenCalledWith('84', expect.anything());
    expect(dependencias.preguntas.resolverRevision).not.toHaveBeenCalled();
  });

  it('con los dos revisores aplica el resultado a nombre de quien entregó la última', async () => {
    const { dependencias, resolver, tx } = escenario([asignacion('21'), asignacion('22')]);

    await resolver();

    expect(dependencias.preguntas.resolverRevision).toHaveBeenCalledWith(
      '22',
      '84',
      { estado: 'aprobada', dificultad: 'media', posibleAmbigua: false },
      tx,
    );
    expect(dependencias.revisores.asignarRevisores).not.toHaveBeenCalled();
  });

  it('rechazada u observada no asigna dificultad', async () => {
    const { dependencias, resolver } = escenario([
      asignacion('21', { decision: 'observar', dificultad: 'facil' }),
      asignacion('22', { decision: 'aprobar', dificultad: 'dificil' }),
    ]);

    await resolver();

    expect(dependencias.preguntas.resolverRevision).toHaveBeenCalledWith(
      '22',
      '84',
      { estado: 'observada', dificultad: null, posibleAmbigua: true },
      expect.anything(),
    );
  });

  it('si no coinciden, asigna el desempate al docente del área con menos carga que no revisó', async () => {
    const { dependencias, resolver } = escenario(
      [asignacion('21', { dificultad: 'facil' }), asignacion('22', { dificultad: 'dificil' })],
      ['22', '21', '23', '24'],
    );

    await resolver();

    expect(dependencias.revisores.asignarRevisores).toHaveBeenCalledWith(
      {
        preguntaId: '84',
        ronda: 2,
        version: 4,
        docenteIds: ['23'],
        ...PLAZO,
        rol: 'desempate',
      },
      expect.anything(),
    );
    expect(dependencias.preguntas.resolverRevision).toHaveBeenCalledWith(
      '22',
      '84',
      { estado: 'en_desempate', dificultad: null, posibleAmbigua: true },
      expect.anything(),
    );
  });

  it('sin un tercer docente disponible la pregunta sigue en revisión', async () => {
    const { dependencias, resolver } = escenario(
      [asignacion('21', { decision: 'rechazar' }), asignacion('22')],
      ['21', '22'],
    );

    await resolver();

    expect(dependencias.revisores.asignarRevisores).not.toHaveBeenCalled();
    expect(dependencias.preguntas.resolverRevision).not.toHaveBeenCalled();
  });

  it('una ronda que ya tiene tercer docente no se vuelve a resolver', async () => {
    const { dependencias, resolver } = escenario([
      asignacion('21', { decision: 'rechazar' }),
      asignacion('22'),
      asignacion('23', { rol: 'desempate', estado: 'pendiente', decision: null, dificultad: null }),
    ]);

    await resolver();

    expect(dependencias.revisores.asignarRevisores).not.toHaveBeenCalled();
    expect(dependencias.preguntas.resolverRevision).not.toHaveBeenCalled();
  });
});
