// Revisión docente (HU-22, RF-G07, RN-11): con más criterios en «No» que max_no_para_aprobar no se puede
// aprobar; solo observar o rechazar. Sin PostgreSQL: el servicio real con el parámetro y la bandeja falsos.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { appDeRevision, bandejaDePrueba, comoDocente, PAUTA } from './bandeja-de-prueba.js';
import { problemas } from './edicion-de-prueba.js';

const RUTA = '/api/v1/admin/revision/mis-revisiones';

/** La app con el máximo de «No» para aprobar que se pida (el parámetro de la configuración). */
function escenario(maximo: number) {
  const repositorio = bandejaDePrueba('pendiente');
  const { app } = appDeRevision({
    repositorioBandeja: repositorio,
    administracion: {
      obtenerParametroEntero: (clave) =>
        Promise.resolve(clave === 'max_no_para_aprobar' ? maximo : 2),
      registrarAuditoria: () => Promise.resolve(),
    },
    repositorioResolucion: {
      reservarPregunta: () => Promise.resolve(),
      asignacionesDeLaRonda: () => Promise.resolve([]),
    },
  });
  return { app, repositorio };
}

/** Una revisión con `noes` criterios en «No» (con su observación) y el resto en «Sí». */
const conNoes = (noes: number, decision: string, comentario?: string) => ({
  criterios: PAUTA.map(({ codigo }, i) =>
    i < noes ? { codigo, cumple: false, observacion: 'No se cumple.' } : { codigo, cumple: true },
  ),
  dificultad: 'media',
  decision,
  ...(comentario ? { comentario } : {}),
});

const entregar = async (app: ReturnType<typeof escenario>['app'], cuerpo: unknown) =>
  request(app)
    .post(`${RUTA}/900`)
    .set(await comoDocente())
    .send(cuerpo as object);

describe('aprobar con criterios en «No»', () => {
  it('al abrir la revisión entrega cuántos «No» permiten aprobar', async () => {
    const { app } = escenario(1);
    const respuesta = await request(app)
      .get(`${RUTA}/900`)
      .set(await comoDocente());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.maximoNoParaAprobar).toBe(1);
  });

  it('aprueba con tantos «No» como el máximo, y con menos', async () => {
    const { app, repositorio } = escenario(1);
    expect((await entregar(app, conNoes(1, 'aprobar'))).status).toBe(201);
    expect(repositorio.guardarRevision).toHaveBeenCalledTimes(1);
  });

  it('con más «No» que el máximo no deja aprobar (400) y no guarda nada', async () => {
    const { app, repositorio } = escenario(1);
    const respuesta = await entregar(app, conNoes(2, 'aprobar'));
    expect(respuesta.status).toBe(400);
    expect(problemas(respuesta)).toEqual([
      'decision: No puedes aprobar la pregunta: tiene 2 criterios en «No» y se aprueba con 1 como máximo. Obsérvala o recházala.',
    ]);
    expect(repositorio.guardarRevision).not.toHaveBeenCalled();
  });

  it('con el máximo en 0, un solo «No» impide aprobar y el mensaje va en singular', async () => {
    const { app } = escenario(0);
    const respuesta = await entregar(app, conNoes(1, 'aprobar'));
    expect(respuesta.status).toBe(400);
    expect(problemas(respuesta)[0]).toContain('tiene 1 criterio en «No»');
  });

  it.each(['observar', 'rechazar'])('con muchos «No» sí se puede %s', async (decision) => {
    const { app, repositorio } = escenario(0);
    const respuesta = await entregar(app, conNoes(2, decision, 'Hay que corregirla.'));
    expect(respuesta.status).toBe(201);
    expect(repositorio.guardarRevision).toHaveBeenCalledTimes(1);
  });
});
