// HU-60.1 (CU-28, RF-A22, RN-19, RN-21) contra PostgreSQL real: la evaluación sin terminar se retoma
// donde quedó; al consultarla se cierra si venció o si es una práctica sin actividad, y la tarea
// periódica (DAS 4.3.3) cierra las demás con su clave.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { evaluacionConTiempo, marcar, publicadas } from './evaluaciones-con-tiempo.js';
import { prepararRespuestas } from './respuestas-de-prueba.js';

const RUTA_ABIERTA = '/api/v1/app/evaluaciones/abierta';
const RUTA_TAREAS = '/api/v1/tareas/periodicas';
// Valor de prueba, no es un secreto. secretlint-disable-next-line
const CLAVE_TAREAS = 'clave-de-tareas-de-prueba-con-32-caracteres';

exigirBaseEnCi();
describe.skipIf(!urlBase)('evaluación abierta y tareas periódicas con PostgreSQL (HU-60.1)', () => {
  const r = prepararRespuestas('abierta');
  const { base, entorno } = r;

  const abierta = (token: string) =>
    request(entorno.app).get(RUTA_ABIERTA).set('Authorization', `Bearer ${token}`);

  /** Hace como si la última respuesta hubiera sido hace esas horas. */
  const sinActividadDesde = (id: string, horas: number) =>
    entorno.bd.query(
      `UPDATE app.evaluacion SET ultima_actividad_en = now() - $2 * INTERVAL '1 hour' WHERE id = $1`,
      [id, horas],
    );

  const estadoDe = async (id: string) => {
    const { rows } = await entorno.bd.query<{ estado: string }>(
      `SELECT ee.codigo AS estado FROM app.evaluacion e
         JOIN contenido.estado_evaluacion ee ON ee.id = e.estado_evaluacion_id WHERE e.id = $1`,
      [id],
    );
    return rows[0]?.estado;
  };

  it('sin nada abierto responde null', async () => {
    const { token } = await base.sesion();

    const respuesta = await abierta(token);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({ abierta: null, cerrada: null });
  });

  it('la práctica sin terminar se retoma en la pregunta pendiente, con lo respondido (CU-28)', async () => {
    await base.publicar(6, { prueba: 'M1', dificultad: 'media' });
    const { token } = await base.sesion();
    const primera = await r.practicaConPregunta(token, 5);
    await r.responderCon(token, primera, 'A');
    const segunda = { ...primera, itemId: await r.entregar(token, primera.practicaId) };
    await r.responderCon(token, segunda, 'B');
    const pendiente = await r.entregar(token, primera.practicaId);

    const respuesta = await abierta(token);

    expect(respuesta.body.data.cerrada).toBeNull();
    expect(respuesta.body.data.abierta).toMatchObject({
      id: Number(primera.practicaId),
      tipo: { codigo: 'practica' },
      prueba: { id: base.pruebaId, codigo: 'M1' },
      cantidad: 5,
      respondidas: 2,
      venceEn: null,
      segundosRestantes: null,
    });
    // Retomar es pedir la siguiente: entrega la misma pregunta que quedó sin responder.
    expect(await r.entregar(token, primera.practicaId)).toBe(pendiente);
  });

  it('una práctica sin actividad por 2 horas se cierra como abandonada al consultarla (RN-19)', async () => {
    await base.publicar(5, { prueba: 'M1', dificultad: 'media' });
    const { token } = await base.sesion();
    const primera = await r.practicaConPregunta(token, 5);
    await r.responderCon(token, primera, 'A');
    await sinActividadDesde(primera.practicaId, 1.9);
    expect((await abierta(token)).body.data.abierta).not.toBeNull();

    await sinActividadDesde(primera.practicaId, 2.1);
    const respuesta = await abierta(token);

    expect(respuesta.body.data).toEqual({
      abierta: null,
      cerrada: {
        id: Number(primera.practicaId),
        tipo: { codigo: 'practica', nombre: expect.any(String) as string },
        estado: 'abandonada',
      },
    });
    expect(await estadoDe(primera.practicaId)).toBe('abandonada');
    // Conserva lo respondido.
    const resultado = await request(entorno.app)
      .get(`/api/v1/app/evaluaciones/${primera.practicaId}/resultado`)
      .set('Authorization', `Bearer ${token}`);
    expect(resultado.body.data).toMatchObject({ correctas: 1 });
  });

  it('con tiempo muestra lo que queda; vencida, se cierra y se corrige (RN-21)', async () => {
    const { id: estudianteId, token } = await base.sesion();
    const preguntas = await publicadas(entorno.bd, 3);
    const [id = '', item = ''] = await evaluacionConTiempo(entorno.bd, {
      estudianteId,
      pruebaId: base.pruebaId,
      tipo: 'mini_ensayo',
      preguntas,
      haceMin: 10,
    });
    await marcar(entorno.bd, item, 'A');
    // Sin actividad hace horas no importa: solo la práctica y el repaso se abandonan.
    await sinActividadDesde(id, 5);

    const enCurso = (await abierta(token)).body.data.abierta;
    expect(enCurso).toMatchObject({ tipo: { codigo: 'mini_ensayo' }, cantidad: 3, respondidas: 1 });
    expect(enCurso.venceEn).not.toBeNull();
    const { rows } = await entorno.bd.query<{ segundos: number }>(
      `SELECT EXTRACT(EPOCH FROM vence_en - now())::int AS segundos FROM app.evaluacion WHERE id = $1`,
      [id],
    );
    expect(Math.abs((enCurso.segundosRestantes as number) - (rows[0]?.segundos ?? 0))).toBeLessThan(
      5,
    );

    // Otro que empezó hace 10 horas: su hora de término ya pasó (la base no deja cambiarla).
    const beto = await base.sesion('beto@ejemplo.cl');
    const [vencida = ''] = await evaluacionConTiempo(entorno.bd, {
      estudianteId: beto.id,
      pruebaId: base.pruebaId,
      tipo: 'mini_ensayo',
      preguntas,
      haceMin: 600,
    });
    const respuesta = await abierta(beto.token);

    expect(respuesta.body.data).toMatchObject({
      abierta: null,
      cerrada: { id: Number(vencida), estado: 'tiempo_agotado' },
    });
    expect(await estadoDe(vencida)).toBe('tiempo_agotado');
    expect(await estadoDe(id)).toBe('en_curso');
  });

  it('solo muestra la propia y exige sesión', async () => {
    await base.publicar(5, { prueba: 'M1', dificultad: 'media' });
    const ana = await base.sesion('ana@ejemplo.cl');
    await r.practicaConPregunta(ana.token, 5);
    const beto = await base.sesion('beto@ejemplo.cl');

    expect((await abierta(beto.token)).body.data).toEqual({ abierta: null, cerrada: null });
    expect((await request(entorno.app).get(RUTA_ABIERTA)).status).toBe(401);
  });

  it('la tarea periódica cierra las vencidas y las inactivas, solo con su clave (DAS 4.3.3)', async () => {
    await base.publicar(5, { prueba: 'M1', dificultad: 'media' });
    const ana = await base.sesion('ana@ejemplo.cl');
    const practica = await r.practicaConPregunta(ana.token, 5);
    await sinActividadDesde(practica.practicaId, 3);
    const beto = await base.sesion('beto@ejemplo.cl');
    const [ensayo = ''] = await evaluacionConTiempo(entorno.bd, {
      estudianteId: beto.id,
      pruebaId: base.pruebaId,
      tipo: 'mini_ensayo',
      preguntas: await publicadas(entorno.bd, 1),
      haceMin: 600,
    });
    const app = entorno.crearAppCon({ claveTareas: CLAVE_TAREAS });
    const tarea = (autorizacion?: string) => {
      const peticion = request(app).post(RUTA_TAREAS);
      return autorizacion ? peticion.set('Authorization', autorizacion) : peticion;
    };

    expect((await tarea()).status).toBe(401);
    expect((await tarea(`Bearer ${CLAVE_TAREAS}x`)).status).toBe(401);
    expect(await estadoDe(practica.practicaId)).toBe('en_curso');
    // Sin la clave configurada, la ruta no existe.
    expect((await request(entorno.app).post(RUTA_TAREAS)).status).toBe(404);

    const respuesta = await tarea(`Bearer ${CLAVE_TAREAS}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({ evaluacionesCerradas: 2 });
    expect(await estadoDe(practica.practicaId)).toBe('abandonada');
    expect(await estadoDe(ensayo)).toBe('tiempo_agotado');
    expect((await tarea(`Bearer ${CLAVE_TAREAS}`)).body.data).toEqual({ evaluacionesCerradas: 0 });
  });
});
