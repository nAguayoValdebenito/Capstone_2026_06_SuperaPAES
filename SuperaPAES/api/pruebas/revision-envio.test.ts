// Enviar una pregunta a revisión por HTTP (HU-21, CU-18 y CU-18a, RF-G06, RN-10, CP-15), sin
// PostgreSQL: el servicio real de revision con un repositorio y un módulo preguntas falsos. Quiénes son
// los docentes disponibles (área, autor, solicitante del lote) lo prueba revision-envio-bd.test.ts.
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { ErrorConflicto } from '../comun/errores.js';
import type { RevisionRepositorio } from '../modulos/revision/revision.repositorio.js';
import { crearRevisionServicio } from '../modulos/revision/index.js';
import { crearAppDePrueba, errorConFormato, tokenAdmin } from './ayudantes.js';

const RUTA = '/api/v1/admin/revision/preguntas';
const AHORA = new Date('2026-11-02T12:00:00.000Z');

const docente = (id: string) => ({ id, nombre: `Docente ${id}`, correo: `d${id}@superapaes.cl` });

/** Revision con los docentes disponibles indicados (ya ordenados por carga) y la pregunta enviable. */
function escenario({
  disponibles = [docente('21'), docente('22'), docente('23')],
  pasarARevision = vi.fn(() => Promise.resolve({ version: 3, ronda: 2 })),
} = {}) {
  const repositorio = {
    docentesDisponibles: vi.fn(() => Promise.resolve(disponibles)),
    areaDeLaPregunta: vi.fn(() => Promise.resolve('Historia')),
    asignarRevisores: vi.fn(
      ({ docenteIds, venceEn }: { docenteIds: readonly string[]; venceEn: Date }) =>
        Promise.resolve(
          docenteIds.map((docenteId, i) => ({ id: String(500 + i), docenteId, venceEn })),
        ),
    ),
  } satisfies RevisionRepositorio;
  const administracion = {
    obtenerParametroEntero: vi.fn((clave: string) =>
      Promise.resolve(clave === 'revisores_requeridos' ? 2 : 3),
    ),
    registrarAuditoria: vi.fn(() => Promise.resolve()),
  };
  const tx = { query: () => Promise.reject(new Error('sin base')) };
  const revision = crearRevisionServicio({
    bd: tx,
    unidadDeTrabajo: { enTransaccion: (trabajo) => trabajo(tx) },
    reloj: () => AHORA,
    administracion,
    preguntas: { pasarARevision },
    repositorio,
  });
  const app = crearAppDePrueba({}, { revision });
  return { app, repositorio, administracion, pasarARevision };
}

const comoAdmin = async () => ({ Authorization: `Bearer ${await tokenAdmin('admin', '5')}` });

describe('enviar una pregunta a revisión (HU-21, CU-18)', () => {
  it('CP-15: la pasa a en revisión y la asigna a los dos docentes con menos carga, con su plazo', async () => {
    const { app, repositorio, administracion, pasarARevision } = escenario();

    const respuesta = await request(app)
      .post(`${RUTA}/84`)
      .set(await comoAdmin());

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toEqual({
      preguntaId: 84,
      ronda: 2,
      version: 3,
      revisores: [
        {
          asignacionId: 500,
          docente: { id: 21, nombre: 'Docente 21', correo: 'd21@superapaes.cl' },
          venceEn: '2026-11-05T12:00:00.000Z',
        },
        {
          asignacionId: 501,
          docente: { id: 22, nombre: 'Docente 22', correo: 'd22@superapaes.cl' },
          venceEn: '2026-11-05T12:00:00.000Z',
        },
      ],
    });
    expect(pasarARevision).toHaveBeenCalledWith('5', '84', expect.anything());
    expect(repositorio.asignarRevisores).toHaveBeenCalledWith(
      {
        preguntaId: '84',
        ronda: 2,
        version: 3,
        docenteIds: ['21', '22'],
        asignadoEn: AHORA,
        venceEn: new Date('2026-11-05T12:00:00.000Z'),
      },
      expect.anything(),
    );
    expect(administracion.registrarAuditoria).toHaveBeenCalledWith(
      {
        usuarioId: '5',
        accion: 'enviar_a_revision',
        entidad: 'pregunta',
        entidadId: '84',
        antes: null,
        despues: {
          ronda: 2,
          version: 3,
          revisores: [
            { id: '21', correo: 'd21@superapaes.cl' },
            { id: '22', correo: 'd22@superapaes.cl' },
          ],
        },
      },
      expect.anything(),
    );
  });

  it('CP-15: sin dos docentes del área no asigna nada y avisa (HU-21 esc. 3)', async () => {
    const { app, repositorio, administracion } = escenario({ disponibles: [docente('21')] });

    const respuesta = await request(app)
      .post(`${RUTA}/84`)
      .set(await comoAdmin());

    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toMatchObject(errorConFormato('CONFLICTO'));
    expect(respuesta.body.error.mensaje).toBe(
      'La pregunta no tiene 2 docentes de Historia disponibles para revisarla: asigna el área a un docente en Usuarios internos.',
    );
    expect(repositorio.asignarRevisores).not.toHaveBeenCalled();
    expect(administracion.registrarAuditoria).not.toHaveBeenCalled();
  });

  it('una pregunta que no se puede enviar (otra etapa o sin cumplir RN-08) responde 409 sin asignar', async () => {
    const motivo =
      'La pregunta está «En revisión»: solo se envían a revisión las preguntas en borrador u observadas.';
    const { app, repositorio } = escenario({
      pasarARevision: vi.fn(() => Promise.reject(new ErrorConflicto(motivo))),
    });

    const respuesta = await request(app)
      .post(`${RUTA}/84`)
      .set(await comoAdmin());

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.mensaje).toBe(motivo);
    expect(repositorio.docentesDisponibles).not.toHaveBeenCalled();
  });

  it('solo el administrador envía a revisión, y el id de la pregunta debe ser válido', async () => {
    const { app } = escenario();
    const docenteToken = { Authorization: `Bearer ${await tokenAdmin('docente', '21')}` };

    const comoDocente = await request(app).post(`${RUTA}/84`).set(docenteToken);
    const idInvalido = await request(app)
      .post(`${RUTA}/abc`)
      .set(await comoAdmin());

    expect(comoDocente.status).toBe(403);
    expect(idInvalido.status).toBe(400);
  });
});
