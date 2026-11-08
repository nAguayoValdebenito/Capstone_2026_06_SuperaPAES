// HU-62.1 (RF-A24, CU-30, A34), contra PostgreSQL real: las evaluaciones cerradas del estudiante, de la más
// reciente a la más antigua, por páginas y con filtros por prueba y por tipo.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararRespuestas } from './respuestas-de-prueba.js';

const RUTA = '/api/v1/app/evaluaciones';

exigirBaseEnCi();
describe.skipIf(!urlBase)('historial con PostgreSQL (HU-62.1)', () => {
  const r = prepararRespuestas('historial');
  const { base, entorno } = r;

  const historial = (token: string, consulta: Record<string, string | number> = {}) =>
    request(entorno.app)
      .get(`${RUTA}/historial`)
      .query(consulta)
      .set('Authorization', `Bearer ${token}`);

  /** Una práctica con una respuesta correcta; la deja cerrada si `cerrar`. */
  async function practicar(token: string, cerrar = true) {
    const { practicaId, itemId } = await r.practicaConPregunta(token, 5);
    await r.responderHttp(
      token,
      { practicaId, itemId },
      { alternativaId: await r.alternativa(itemId, 'A') },
    );
    if (cerrar) {
      const cierre = await request(entorno.app)
        .post(`${RUTA}/practicas/${practicaId}/cerrar`)
        .set('Authorization', `Bearer ${token}`);
      expect(cierre.status).toBe(200);
    }
    return practicaId;
  }

  /** Un repaso cerrado, directo en la base: sirve para probar el filtro por tipo. */
  async function repasoCerrado(id: string) {
    const repaso = await base.crearEvaluacionAbierta('repaso', id, base.pruebaId);
    await entorno.bd.query("SELECT app.cerrar_evaluacion($1, 'entregada')", [repaso]);
    return repaso;
  }

  it('sin evaluaciones cerradas la lista está vacía (CU-30 2.a)', async () => {
    const { token } = await base.sesion('vacio@ejemplo.cl');

    const respuesta = await historial(token);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual([]);
    expect(respuesta.body.meta).toEqual({ pagina: 1, porPagina: 20, total: 0 });
  });

  it('entrega fecha, tipo, prueba, alcance, preguntas, correctas y porcentaje (CU-30 paso 2)', async () => {
    await base.publicar(5, { prueba: 'M1', dificultad: 'media' });
    const { token } = await base.sesion('fila@ejemplo.cl');
    const id = await practicar(token);

    const [fila] = (await historial(token)).body.data as Record<string, unknown>[];

    expect(fila).toMatchObject({
      id: Number(id),
      tipo: { codigo: 'practica', nombre: 'Práctica' },
      prueba: { id: base.pruebaId, codigo: 'M1' },
      estado: { codigo: 'entregada' },
      alcance: { tipo: 'prueba', id: base.pruebaId },
      cantidad: 5,
      correctas: 1,
      porcentaje: 100,
      puntaje: null,
      recalculadoEn: null,
    });
    expect(typeof fila?.cerradaEn).toBe('string');
  });

  it('marca la abandonada y no muestra la que sigue abierta (CU-30 2.c)', async () => {
    await base.publicar(10, { prueba: 'M1', dificultad: 'media' });
    const { token } = await base.sesion('abandona@ejemplo.cl');
    const abandonada = await practicar(token, false);
    const abierta = await practicar(token, false);

    const filas = (await historial(token)).body.data as { id: number; estado: object }[];

    expect(filas.map(({ id }) => id)).toEqual([Number(abandonada)]);
    expect(filas[0]?.estado).toMatchObject({ codigo: 'abandonada' });
    expect(abierta).not.toBe(abandonada);
  });

  it('ordena de la más reciente a la más antigua y filtra por tipo y por prueba', async () => {
    await base.publicar(5, { prueba: 'M1', dificultad: 'media' });
    const { id, token } = await base.sesion('filtros@ejemplo.cl', [base.pruebaId, base.lectoraId]);
    const practica = await practicar(token);
    const repaso = await repasoCerrado(id);

    const todas = (await historial(token)).body.data as { id: number }[];
    const repasos = (await historial(token, { tipo: 'repaso' })).body.data as { id: number }[];
    const deLectora = await historial(token, { pruebaId: base.lectoraId });

    expect(todas.map((f) => f.id)).toEqual([Number(repaso), Number(practica)]);
    expect(repasos.map((f) => f.id)).toEqual([Number(repaso)]);
    expect(deLectora.body.data).toEqual([]);
  });

  it('entrega por páginas, con el total', async () => {
    await base.publicar(5, { prueba: 'M1', dificultad: 'media' });
    const { id, token } = await base.sesion('paginas@ejemplo.cl');
    await repasoCerrado(id);
    await repasoCerrado(id);
    await repasoCerrado(id);

    const segunda = await historial(token, { pagina: 2, porPagina: 2 });
    const despues = await historial(token, { pagina: 3, porPagina: 2 });

    expect(segunda.body.data).toHaveLength(1);
    expect(segunda.body.meta).toEqual({ pagina: 2, porPagina: 2, total: 3 });
    expect(despues.body.data).toEqual([]);
    expect(despues.body.meta.total).toBe(3);
  });

  it('filtra los grupos antes de paginar y contar', async () => {
    await base.publicar(5, { prueba: 'M1', dificultad: 'media' });
    const { id, token } = await base.sesion('grupos@ejemplo.cl');
    const practica = await practicar(token);
    const repaso = await repasoCerrado(id);
    const diagnostico = await base.crearEvaluacionAbierta('diagnostico', id, base.pruebaId);
    await entorno.bd.query("SELECT app.cerrar_evaluacion($1, 'entregada')", [diagnostico]);

    const primera = await historial(token, { grupo: 'practicas', porPagina: 1 });
    const segunda = await historial(token, { grupo: 'practicas', porPagina: 1, pagina: 2 });
    const evaluaciones = await historial(token, { grupo: 'evaluaciones' });

    expect(primera.status).toBe(200);
    expect((primera.body.data as { id: number }[]).map((fila) => fila.id)).toEqual([
      Number(repaso),
    ]);
    expect(primera.body.meta.total).toBe(2);
    expect((segunda.body.data as { id: number }[]).map((fila) => fila.id)).toEqual([
      Number(practica),
    ]);
    expect(segunda.body.meta.total).toBe(2);
    expect((evaluaciones.body.data as { id: number }[]).map((fila) => fila.id)).toEqual([
      Number(diagnostico),
    ]);
    expect(evaluaciones.body.meta.total).toBe(1);
    expect((await historial(token, { grupo: 'otro' })).status).toBe(400);
  });

  it('indica el resultado recalculado por una anulación (CU-30 2.b)', async () => {
    await base.publicar(5, { prueba: 'M1', dificultad: 'media' });
    const { token } = await base.sesion('recalcula@ejemplo.cl');
    const id = await practicar(token);
    const { rows } = await entorno.bd.query<{ pregunta_id: string }>(
      'SELECT pregunta_id FROM app.evaluacion_item WHERE evaluacion_id = $1 LIMIT 1',
      [id],
    );
    await entorno.bd.query('SELECT app.anular_pregunta($1)', [rows[0]?.pregunta_id]);

    const [fila] = (await historial(token)).body.data as { recalculadoEn: string | null }[];

    expect(fila?.recalculadoEn).not.toBeNull();
  });

  it('solo muestra las evaluaciones del estudiante de la sesión', async () => {
    await base.publicar(5, { prueba: 'M1', dificultad: 'media' });
    const ana = await base.sesion('ana@ejemplo.cl');
    const beto = await base.sesion('beto@ejemplo.cl');
    await practicar(ana.token);

    expect((await historial(beto.token)).body.data).toEqual([]);
  });

  it('valida los filtros y pide sesión', async () => {
    const { token } = await base.sesion('valida@ejemplo.cl');

    expect((await historial(token, { pruebaId: 'M1' })).status).toBe(400);
    expect((await historial(token, { otro: 1 })).status).toBe(400);
    expect((await request(entorno.app).get(`${RUTA}/historial`)).status).toBe(401);
  });
});
