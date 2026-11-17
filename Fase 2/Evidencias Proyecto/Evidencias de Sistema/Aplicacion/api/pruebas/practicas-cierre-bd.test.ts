// HU-30.1: cierre y resumen de la práctica contra PostgreSQL real. CP-44 se recorre por HTTP;
// la base corrige y calcula los resultados. Cerrar y consultar el resumen no usan cupo (HU-33/CU-07b).
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { RUTA_PRACTICAS } from './base-practicas.js';
import { prepararRespuestas } from './respuestas-de-prueba.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('cierre y resumen de prácticas con PostgreSQL (CP-44)', () => {
  const r = prepararRespuestas('practicas_cierre');
  const { base, entorno } = r;

  beforeEach(async () => {
    await base.publicar(12, { prueba: 'M1', dificultad: 'media' });
  });

  async function iniciar(token: string, cantidad: number, alcance: Record<string, number> = {}) {
    const respuesta = await base.inicio(token, {
      pruebaId: base.pruebaId,
      dificultadId: base.mediaId,
      cantidad,
      ...alcance,
    });
    expect(respuesta.status).toBe(201);
    return String(respuesta.body.data.id as number);
  }

  async function entregarYResponder(
    token: string,
    practicaId: string,
    letra: 'A' | 'B',
  ): Promise<string> {
    const itemId = await r.entregar(token, practicaId);
    const respuesta = await r.responderCon(token, { practicaId, itemId }, letra);
    expect(respuesta.status).toBe(200);
    return itemId;
  }

  it('CP-44: responde diez, completa, cierra, devuelve el mismo resumen y aparece en el historial', async () => {
    const { token } = await base.sesion();
    const { ejeId } = await base.contenido(base.pruebaId);
    const practicaId = await iniciar(token, 10, { ejeId });
    let ultimoItem = '';
    for (let indice = 0; indice < 10; indice++)
      ultimoItem = await entregarYResponder(token, practicaId, indice % 2 === 0 ? 'A' : 'B');

    const completa = await base.siguiente(token, practicaId);
    expect(completa.status).toBe(409);
    expect(completa.body.error.codigo).toBe('PRACTICA_COMPLETA');

    const cierre = await base.cerrar(token, practicaId);
    expect(cierre.status).toBe(200);
    expect(cierre.body.data).toMatchObject({
      id: Number(practicaId),
      prueba: { id: base.pruebaId, codigo: 'M1' },
      alcance: { tipo: 'eje', id: ejeId },
      dificultad: { id: base.mediaId, codigo: 'media' },
      cantidad: 10,
      respondidas: 10,
      correctas: 5,
      incorrectas: 5,
      omitidas: 0,
      porcentaje: 50,
      tiempoUsadoSeg: expect.any(Number),
    });
    expect(cierre.body.data.ejes).toEqual([
      expect.objectContaining({
        id: expect.any(Number),
        nombre: expect.any(String),
        preguntas: 10,
        correctas: 5,
      }),
    ]);
    expect(cierre.body.data.habilidades).toEqual([
      expect.objectContaining({
        id: expect.any(Number),
        nombre: expect.any(String),
        preguntas: 10,
        correctas: 5,
      }),
    ]);
    expect(JSON.stringify(cierre.body)).not.toMatch(
      /puntaje|alternativaCorrecta|explicacion|enunciado|Explicación reservada/i,
    );

    const resumen = await base.resumen(token, practicaId);
    expect(resumen.status).toBe(200);
    expect(resumen.body).toEqual(cierre.body);
    const { rows: historial } = await entorno.bd.query<{
      estado: string;
      correctas: number;
      incorrectas: number;
      omitidas: number;
      porcentaje: string;
    }>(
      'SELECT estado, correctas, incorrectas, omitidas, porcentaje FROM app.v_historial WHERE evaluacion_id=$1',
      [practicaId],
    );
    expect(historial[0]).toMatchObject({
      estado: 'entregada',
      correctas: 5,
      incorrectas: 5,
      omitidas: 0,
    });

    const siguiente = await base.siguiente(token, practicaId);
    expect(siguiente.status).toBe(409);
    expect(siguiente.body.error.codigo).toBe('EVALUACION_CERRADA');
    const alternativaId = await r.alternativa(ultimoItem, 'A');
    const otraRespuesta = await r.responderHttp(
      token,
      { practicaId, itemId: ultimoItem },
      { alternativaId },
    );
    expect(otraRespuesta.status).toBe(409);
    expect(otraRespuesta.body.error.codigo).toBe('EVALUACION_CERRADA');
  });

  it('cierra antes con tres de diez y no cuenta las siete no entregadas como omitidas', async () => {
    const { token } = await base.sesion('cierre-temprano@ejemplo.cl');
    const practicaId = await iniciar(token, 10);
    await entregarYResponder(token, practicaId, 'A');
    await entregarYResponder(token, practicaId, 'B');
    await entregarYResponder(token, practicaId, 'A');
    await r.entregar(token, practicaId); // entregada pero sin responder: en práctica no cuenta

    const cierre = await base.cerrar(token, practicaId);

    expect(cierre.status).toBe(200);
    expect(cierre.body.data).toMatchObject({
      cantidad: 10,
      respondidas: 3,
      correctas: 2,
      incorrectas: 1,
      omitidas: 0,
    });
  });

  it('cierra con cero respuestas como entregada y cierre/resumen funcionan con el cupo agotado', async () => {
    const { id: estudianteId, token } = await base.sesion('sin-respuestas@ejemplo.cl');
    const practicaId = await iniciar(token, 5);
    const fecha = await r.fechaDelReloj();
    await r.fijarCupo(estudianteId, fecha, 10, 10);

    const cierre = await base.cerrar(token, practicaId);
    const resumen = await base.resumen(token, practicaId);

    expect(cierre.status).toBe(200);
    expect(cierre.body.data).toMatchObject({
      respondidas: 0,
      correctas: 0,
      incorrectas: 0,
      omitidas: 0,
      porcentaje: 0,
      ejes: [],
      habilidades: [],
    });
    expect(resumen.status).toBe(200);
    expect(resumen.body).toEqual(cierre.body);
    expect(await r.cupoDe(estudianteId, fecha)).toEqual({ maximo: 10, usadas: 10 });
    const { rows } = await entorno.bd.query<{ estado: string }>(
      'SELECT estado FROM app.v_historial WHERE evaluacion_id=$1',
      [practicaId],
    );
    expect(rows[0]?.estado).toBe('entregada');
  });

  it('una práctica abandonada conserva resultado y permite consultar su resumen', async () => {
    const { token } = await base.sesion('abandonada@ejemplo.cl');
    const primera = await iniciar(token, 5);
    await entregarYResponder(token, primera, 'A');
    expect(await iniciar(token, 5)).not.toBe(primera);

    const resumen = await base.resumen(token, primera);

    expect(resumen.status).toBe(200);
    expect(resumen.body.data).toMatchObject({ respondidas: 1, correctas: 1, incorrectas: 0 });
  });

  it('oculta prácticas ajenas e inexistentes y distingue resumen abierto de práctica cerrada', async () => {
    const ana = await base.sesion('errores-ana@ejemplo.cl');
    const beto = await base.sesion('errores-beto@ejemplo.cl');
    const practicaId = await iniciar(ana.token, 5);

    const abierta = await base.resumen(ana.token, practicaId);
    expect(abierta.status).toBe(409);
    expect(abierta.body.error.codigo).toBe('EVALUACION_ABIERTA');
    for (const respuesta of [
      await base.cerrar(beto.token, practicaId),
      await base.resumen(beto.token, practicaId),
      await base.cerrar(ana.token, '999999999'),
      await base.resumen(ana.token, '999999999'),
    ]) {
      expect(respuesta.status).toBe(404);
      expect(respuesta.body.error.codigo).toBe('EVALUACION_NO_ENCONTRADA');
    }

    expect((await base.cerrar(ana.token, practicaId)).status).toBe(200);
    const repetido = await base.cerrar(ana.token, practicaId);
    expect(repetido.status).toBe(409);
    expect(repetido.body.error.codigo).toBe('EVALUACION_CERRADA');
  });

  it('dos cierres simultáneos se ordenan con el bloqueo y guardan un solo resultado', async () => {
    const { token } = await base.sesion('cierres-simultaneos@ejemplo.cl');
    const practicaId = await iniciar(token, 5);

    const respuestas = await Promise.all([
      base.cerrar(token, practicaId),
      base.cerrar(token, practicaId),
    ]);

    expect(respuestas.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(respuestas.find(({ status }) => status === 409)?.body.error.codigo).toBe(
      'EVALUACION_CERRADA',
    );
    const { rows } = await entorno.bd.query<{ resultados: number }>(
      'SELECT count(*)::int AS resultados FROM app.resultado_evaluacion WHERE evaluacion_id=$1',
      [practicaId],
    );
    expect(rows[0]?.resultados).toBe(1);
  });

  it('cierre y resumen exigen sesión de estudiante e ids enteros seguros', async () => {
    const { token } = await base.sesion('seguridad-cierre@ejemplo.cl');
    const practicaId = await iniciar(token, 5);
    for (const ruta of [
      `${RUTA_PRACTICAS}/${practicaId}/cerrar`,
      `${RUTA_PRACTICAS}/${practicaId}/resumen`,
    ]) {
      const respuesta = ruta.endsWith('/cerrar')
        ? await request(entorno.app).post(ruta)
        : await request(entorno.app).get(ruta);
      expect(respuesta.status).toBe(401);
      expect(respuesta.body.error.codigo).toBe('NO_AUTENTICADO');
    }
    for (const id of ['1.5', '9007199254740992']) {
      expect((await base.cerrar(token, id)).body.error.codigo).toBe('VALIDACION');
      expect((await base.resumen(token, id)).body.error.codigo).toBe('VALIDACION');
    }
  });
});
