// Bandeja del docente revisor por HTTP (HU-22, CU-19, RF-G07, CP-16 paso 3), sin PostgreSQL: el
// servicio real de revision con un repositorio de la bandeja falso. Lo que guarda la base y que la
// consulta no lea la dificultad sugerida ni la revisión del otro docente está en revision-bandeja-bd.test.ts.
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { BandejaRepositorio } from '../modulos/revision/revision.bandeja.repositorio.js';
import { crearRevisionServicio } from '../modulos/revision/index.js';
import { crearAppDePrueba, errorConFormato, tokenAdmin } from './ayudantes.js';
import { problemas } from './edicion-de-prueba.js';

const RUTA = '/api/v1/admin/revision/mis-revisiones';
const AHORA = new Date('2026-11-03T15:00:00.000Z');
const VENCE = new Date('2026-11-05T12:00:00.000Z');

const PAUTA = [
  { codigo: 'contenido', descripcion: 'La pregunta evalúa el contenido.' },
  { codigo: 'enunciado', descripcion: 'El enunciado es claro.' },
];

const PENDIENTE = {
  id: '900',
  preguntaId: '7',
  ronda: 1,
  prueba: { codigo: 'M1', nombre: 'Competencia Matemática 1' },
  contenido: 'Ecuaciones',
  venceEn: VENCE,
};

/** Revisión de la bandeja; `estado` es el de su asignación al entregarla (null si no es del docente). */
function escenario({ estado = 'pendiente' }: { estado?: string | null } = {}) {
  const repositorio = {
    listarPendientes: vi.fn(() => Promise.resolve([PENDIENTE])),
    obtenerPendiente: vi.fn((id: string) =>
      Promise.resolve(
        id === '900'
          ? {
              ...PENDIENTE,
              eje: 'Álgebra',
              habilidad: 'Resolver problemas',
              copia: {
                enunciado: 'Si $2x = 8$, ¿cuánto vale $x$?',
                explicacion: 'Se divide por 2.',
                alternativas: [
                  { id: 101, letra: 'A', texto: '2', explicacion: null },
                  { id: 102, letra: 'B', texto: '4', explicacion: null },
                ],
              },
              correctaId: '102',
              texto: null,
            }
          : null,
      ),
    ),
    listarCriterios: vi.fn(() => Promise.resolve(PAUTA)),
    listarDificultades: vi.fn(() =>
      Promise.resolve([
        { codigo: 'facil', nombre: 'Fácil' },
        { codigo: 'media', nombre: 'Media' },
        { codigo: 'dificil', nombre: 'Difícil' },
      ]),
    ),
    listarDecisiones: vi.fn(() =>
      Promise.resolve([
        { codigo: 'aprobar', nombre: 'Aprobar', requiereComentario: false },
        { codigo: 'observar', nombre: 'Observar', requiereComentario: true },
        { codigo: 'rechazar', nombre: 'Rechazar', requiereComentario: true },
      ]),
    ),
    reservarAsignacion: vi.fn(() =>
      Promise.resolve(estado === null ? null : { estado, preguntaId: PENDIENTE.preguntaId }),
    ),
    guardarRevision: vi.fn(() => Promise.resolve()),
  } satisfies BandejaRepositorio;
  const tx = { query: () => Promise.reject(new Error('sin base')) };
  const revision = crearRevisionServicio({
    bd: tx,
    unidadDeTrabajo: { enTransaccion: (trabajo) => trabajo(tx) },
    reloj: () => AHORA,
    administracion: {
      obtenerParametroEntero: () => Promise.resolve(2),
      registrarAuditoria: () => Promise.resolve(),
    },
    preguntas: { pasarARevision: () => Promise.reject(new Error('no se usa')) },
    repositorioBandeja: repositorio,
  });
  return { app: crearAppDePrueba({}, { revision }), repositorio };
}

const comoDocente = async () => ({
  Authorization: `Bearer ${await tokenAdmin('docente', '21')}`,
});

/** Una revisión completa que aprueba, con todos los puntos de la pauta cumplidos. */
const revisionCompleta = (cambios: Record<string, unknown> = {}) => ({
  criterios: PAUTA.map(({ codigo }) => ({ codigo, cumple: true })),
  dificultad: 'media',
  decision: 'aprobar',
  ...cambios,
});

describe('bandeja del docente revisor (HU-22 esc. 1)', () => {
  it('lista sus revisiones pendientes con su fecha límite', async () => {
    const { app, repositorio } = escenario();

    const respuesta = await request(app)
      .get(RUTA)
      .set(await comoDocente());

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual([
      { ...PENDIENTE, id: 900, preguntaId: 7, venceEn: '2026-11-05T12:00:00.000Z' },
    ]);
    expect(repositorio.listarPendientes).toHaveBeenCalledWith('21');
  });

  it('el administrador no entra a la bandeja del docente', async () => {
    const { app } = escenario();

    const respuesta = await request(app)
      .get(RUTA)
      .set({ Authorization: `Bearer ${await tokenAdmin('admin', '5')}` });

    expect(respuesta.status).toBe(403);
  });
});

describe('abrir una revisión (HU-22 esc. 2 y 3, CP-16 paso 3)', () => {
  it('muestra la pregunta con la correcta y la explicación, la pauta y las opciones, a ciegas', async () => {
    const { app, repositorio } = escenario();

    const respuesta = await request(app)
      .get(`${RUTA}/900`)
      .set(await comoDocente());

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      id: 900,
      preguntaId: 7,
      enunciado: 'Si $2x = 8$, ¿cuánto vale $x$?',
      alternativas: [
        { id: 101, letra: 'A', esCorrecta: false },
        { id: 102, letra: 'B', esCorrecta: true },
      ],
      pauta: PAUTA,
    });
    expect(Object.keys(respuesta.body.data as object)).not.toContain('dificultadSugerida');
    expect(JSON.stringify(respuesta.body.data)).not.toMatch(/sugerida|otraRevision|revisor/i);
    expect(repositorio.obtenerPendiente).toHaveBeenCalledWith('900', '21');
  });

  it('una revisión que no es suya o ya entregó no existe para él', async () => {
    const { app } = escenario();

    const respuesta = await request(app)
      .get(`${RUTA}/901`)
      .set(await comoDocente());

    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toMatchObject(errorConFormato('NO_ENCONTRADO'));
  });
});

describe('entregar la revisión (CU-19 pasos 3 a 6)', () => {
  it('guarda la pauta, la dificultad y la decisión, y responde 201', async () => {
    const { app, repositorio } = escenario();

    const respuesta = await request(app)
      .post(`${RUTA}/900`)
      .set(await comoDocente())
      .send(
        revisionCompleta({
          criterios: [
            { codigo: 'contenido', cumple: true },
            { codigo: 'enunciado', cumple: false, observacion: '  Tiene dos lecturas. ' },
          ],
          decision: 'observar',
          comentario: 'Aclarar el enunciado.',
        }),
      );

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toEqual({
      asignacionId: 900,
      preguntaId: 7,
      decision: 'observar',
      dificultad: 'media',
    });
    expect(repositorio.guardarRevision).toHaveBeenCalledWith(
      {
        asignacionId: '900',
        decision: 'observar',
        dificultad: 'media',
        comentario: 'Aclarar el enunciado.',
        criterios: [
          { codigo: 'contenido', cumple: true, observacion: null },
          { codigo: 'enunciado', cumple: false, observacion: 'Tiene dos lecturas.' },
        ],
        entregadaEn: AHORA,
      },
      expect.anything(),
    );
  });

  it('exige todos los puntos de la pauta, la observación de cada «no» y el motivo al observar o rechazar', async () => {
    const { app, repositorio } = escenario();
    const enviar = async (cuerpo: Record<string, unknown>) =>
      request(app)
        .post(`${RUTA}/900`)
        .set(await comoDocente())
        .send(cuerpo);

    const faltaUno = await enviar(
      revisionCompleta({ criterios: [{ codigo: 'contenido', cumple: true }] }),
    );
    const sinObservacion = await enviar(
      revisionCompleta({
        criterios: [
          { codigo: 'contenido', cumple: true },
          { codigo: 'enunciado', cumple: false },
        ],
      }),
    );
    const rechazaSinMotivo = await enviar(revisionCompleta({ decision: 'rechazar' }));
    const opcionesQueNoExisten = await enviar(
      revisionCompleta({ dificultad: 'extrema', decision: 'dudar' }),
    );

    expect(problemas(faltaUno)).toEqual(['criterios: Responde los 2 puntos de la pauta.']);
    expect(problemas(sinObservacion)).toEqual([
      'criterios.enunciado: Escribe por qué no se cumple: «El enunciado es claro.»',
    ]);
    expect(problemas(rechazaSinMotivo)).toEqual([
      'comentario: Escribe el motivo para rechazar la pregunta.',
    ]);
    expect(problemas(opcionesQueNoExisten)).toEqual([
      'dificultad: Elige la dificultad: fácil, media o difícil.',
      'decision: Elige si apruebas, observas o rechazas la pregunta.',
    ]);
    expect(repositorio.reservarAsignacion).not.toHaveBeenCalled();
    expect(repositorio.guardarRevision).not.toHaveBeenCalled();
  });

  it('una revisión ya entregada no se vuelve a entregar (409), y una ajena no existe (404)', async () => {
    const entregada = escenario({ estado: 'completada' });
    const ajena = escenario({ estado: null });

    const otraVez = await request(entregada.app)
      .post(`${RUTA}/900`)
      .set(await comoDocente())
      .send(revisionCompleta());
    const deOtro = await request(ajena.app)
      .post(`${RUTA}/900`)
      .set(await comoDocente())
      .send(revisionCompleta());

    expect(otraVez.status).toBe(409);
    expect(deOtro.status).toBe(404);
    expect(entregada.repositorio.guardarRevision).not.toHaveBeenCalled();
    expect(ajena.repositorio.guardarRevision).not.toHaveBeenCalled();
  });
});
