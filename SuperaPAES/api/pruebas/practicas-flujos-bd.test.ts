// HU-30.1 y HU-31.2: continuidad, concurrencia y textos sobre PostgreSQL temporal.
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { tokenAdmin } from './ayudantes.js';
import { prepararPracticas, RUTA_PRACTICAS } from './base-practicas.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { crearPreguntaPublicada, crearTextoDePrueba } from './preguntas-de-prueba.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('continuidad y textos de prácticas con PostgreSQL', () => {
  const base = prepararPracticas('practicas_flujos');
  const { entorno, sesion, publicar, inicio, siguiente, responder, crearEvaluacionAbierta } = base;
  const RUTA = RUTA_PRACTICAS;
  let pruebaId: number;
  let lectoraId: number;
  beforeAll(() => {
    ({ pruebaId, lectoraId } = base);
  });

  it('RN-19: otra práctica abandona la anterior y conserva su respuesta en el historial', async () => {
    await publicar(10, { prueba: 'M1', dificultad: 'media' });
    const { token } = await sesion();
    const primera = await inicio(token, { pruebaId, cantidad: 5 });
    const id = primera.body.data.id as string;
    const entrega = await siguiente(token, id);
    await responder(entrega.body.data.id as string);
    const segunda = await inicio(token, { pruebaId, cantidad: 5 });
    expect(segunda.status).toBe(201);
    const { rows } = await entorno.bd.query<{ estado: string; correctas: number; cerradaEn: Date }>(
      `SELECT estado, correctas, cerrada_en AS "cerradaEn" FROM app.v_historial WHERE evaluacion_id=$1`,
      [id],
    );
    expect(rows[0]).toMatchObject({ estado: 'abandonada', correctas: 1 });
    expect(rows[0]?.cerradaEn).not.toBeNull();
    const cerrada = await siguiente(token, id);
    expect(cerrada.status).toBe(409);
    expect(cerrada.body.error.codigo).toBe('EVALUACION_CERRADA');
  });

  it('RN-19: también abandona un repaso abierto antes de crear la práctica', async () => {
    await publicar(5, { prueba: 'M1', dificultad: 'media' });
    const { token, id: estudianteId } = await sesion();
    const repasoId = await crearEvaluacionAbierta('repaso', estudianteId, pruebaId);
    const practica = await inicio(token, { pruebaId, cantidad: 5 });
    expect(practica.status).toBe(201);
    const { rows: historial } = await entorno.bd.query<{ estado: string }>(
      'SELECT estado FROM app.v_historial WHERE evaluacion_id=$1',
      [repasoId],
    );
    expect(historial[0]?.estado).toBe('abandonada');
    const noEsPractica = await siguiente(token, repasoId);
    expect(noEsPractica.status).toBe(404);
    expect(noEsPractica.body.error.codigo).toBe('EVALUACION_NO_ENCONTRADA');
  });

  it('RN-19: dos inicios concurrentes dejan una sola evaluación abierta', async () => {
    await publicar(5, { prueba: 'M1', dificultad: 'media' });
    const { token, id } = await sesion();
    const [uno, dos] = await Promise.all([
      inicio(token, { pruebaId, cantidad: 5 }),
      inicio(token, { pruebaId, cantidad: 5 }),
    ]);
    expect([uno.status, dos.status]).toEqual([201, 201]);
    const { rows } = await entorno.bd.query<{ abiertas: number; total: number }>(
      `SELECT count(*) FILTER (WHERE cerrada_en IS NULL)::int AS abiertas,
        count(*)::int AS total FROM app.evaluacion WHERE estudiante_id=$1`,
      [id],
    );
    expect(rows[0]).toEqual({ abiertas: 1, total: 2 });
  });

  it('RN-19: el diagnóstico con tiempo abierto impide empezar y permanece intacto', async () => {
    await publicar(5, { prueba: 'M1', dificultad: 'media' });
    const { token, id: estudianteId } = await sesion();
    const diagnosticoId = await crearEvaluacionAbierta('diagnostico', estudianteId, pruebaId);
    const rechazo = await inicio(token, { pruebaId, cantidad: 5 });
    expect(rechazo.status).toBe(409);
    expect(rechazo.body.error.codigo).toBe('EVALUACION_CON_TIEMPO_ABIERTA');
    const { rows: estado } = await entorno.bd.query<{ id: string; cerradaEn: Date | null }>(
      `SELECT id::text, cerrada_en AS "cerradaEn" FROM app.evaluacion WHERE estudiante_id=$1`,
      [estudianteId],
    );
    expect(estado).toEqual([{ id: diagnosticoId, cerradaEn: null }]);
  });

  it('si el banco cambia después de iniciar, siguiente avisa y deja abierta la práctica', async () => {
    const preguntas = [];
    for (let i = 0; i < 5; i++)
      preguntas.push(
        await crearPreguntaPublicada(entorno.bd, { prueba: 'M1', dificultad: 'media' }),
      );
    const { token, id: estudianteId } = await sesion();
    const creada = await inicio(token, { pruebaId, cantidad: 5 });
    const practicaId = creada.body.data.id as string;
    const primera = await siguiente(token, practicaId);
    expect(primera.status).toBe(200);
    await responder(primera.body.data.id as string);
    const { rows } = await entorno.bd.query<{ preguntaId: string }>(
      `SELECT pregunta_id::text AS "preguntaId" FROM app.evaluacion_item WHERE id=$1`,
      [primera.body.data.id],
    );
    const primeraPregunta = rows[0]?.preguntaId;
    for (const pregunta of preguntas.filter((p) => p.preguntaId !== primeraPregunta))
      await entorno.bd.query(
        `UPDATE contenido.pregunta SET estado_pregunta_id=e.id
         FROM contenido.estado_pregunta e WHERE pregunta.id=$1 AND e.codigo='retirada'`,
        [pregunta.preguntaId],
      );
    const rechazo = await siguiente(token, practicaId);
    expect(rechazo.status).toBe(409);
    expect(rechazo.body.error.codigo).toBe('SIN_PREGUNTAS_SUFICIENTES');
    const { rows: abiertas } = await entorno.bd.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM app.evaluacion
       WHERE estudiante_id=$1 AND id=$2 AND cerrada_en IS NULL`,
      [estudianteId, practicaId],
    );
    expect(abiertas[0]?.total).toBe(1);
  });

  it('siguiente oculta otras prácticas y exige sesión de estudiante', async () => {
    await publicar(5, { prueba: 'M1', dificultad: 'media' });
    const { token } = await sesion();
    const { token: otro } = await sesion('otro@ejemplo.cl');
    const creada = await inicio(token, { pruebaId, cantidad: 5 });
    const id = creada.body.data.id as string;
    const ajena = await siguiente(otro, id);
    const inexistente = await siguiente(otro, '999999999');
    expect(ajena.status).toBe(404);
    expect(ajena.body).toEqual(inexistente.body);
    expect(ajena.body.error.codigo).toBe('EVALUACION_NO_ENCONTRADA');
    const sinSesion = await request(entorno.app).post(RUTA).send({ pruebaId, cantidad: 5 });
    const consola = await inicio(await tokenAdmin(), { pruebaId, cantidad: 5 });
    expect(sinSesion.body.error.codigo).toBe('NO_AUTENTICADO');
    expect(consola.body.error.codigo).toBe('NO_AUTENTICADO');
    expect((await request(entorno.app).post(`${RUTA}/${id}/siguiente`)).body.error.codigo).toBe(
      'NO_AUTENTICADO',
    );
    expect((await siguiente(await tokenAdmin(), id)).body.error.codigo).toBe('NO_AUTENTICADO');
  });

  it('CP-44: Lectora entrega bloques de texto y la habilidad Interpretar', async () => {
    const { rows: habilidades } = await entorno.bd.query<{ id: number }>(
      `SELECT id FROM contenido.habilidad WHERE prueba_id=$1 AND nombre ILIKE '%Interpretar%' ORDER BY id LIMIT 1`,
      [lectoraId],
    );
    const habilidadId = habilidades[0]?.id ?? 0;
    const primero = await crearTextoDePrueba(entorno.bd);
    const segundo = await crearTextoDePrueba(entorno.bd);
    for (let orden = 1; orden <= 5; orden++) {
      await crearPreguntaPublicada(entorno.bd, {
        prueba: 'CL',
        dificultad: 'media',
        habilidadId,
        textoId: primero,
        ordenEnTexto: orden,
      });
      await crearPreguntaPublicada(entorno.bd, {
        prueba: 'CL',
        dificultad: 'media',
        habilidadId,
        textoId: segundo,
        ordenEnTexto: orden,
      });
    }
    const { token } = await sesion('lectora@ejemplo.cl', [lectoraId]);
    const creada = await inicio(token, { pruebaId: lectoraId, habilidadId, cantidad: 10 });
    expect(creada.status).toBe(201);
    const id = creada.body.data.id as string;
    const textos: string[] = [];
    const ordenes: number[] = [];
    for (let orden = 1; orden <= 10; orden++) {
      const entrega = await siguiente(token, id);
      expect(entrega.status).toBe(200);
      expect(entrega.body.data).toMatchObject({ orden, total: 10 });
      const itemId = entrega.body.data.id as string;
      const { rows } = await entorno.bd.query<{
        textoId: string;
        ordenEnTexto: number;
        habilidadId: number;
      }>(
        `SELECT p.texto_estimulo_id::text AS "textoId", p.orden_en_texto AS "ordenEnTexto",
          p.habilidad_id AS "habilidadId" FROM app.evaluacion_item i
          JOIN contenido.pregunta p ON p.id=i.pregunta_id WHERE i.id=$1`,
        [itemId],
      );
      expect(rows[0]?.habilidadId).toBe(habilidadId);
      textos.push(rows[0]?.textoId ?? '');
      ordenes.push(rows[0]?.ordenEnTexto ?? 0);
      await responder(itemId);
    }
    expect(textos.slice(0, 5)).toEqual(Array(5).fill(textos[0]));
    expect(textos.slice(5)).toEqual(Array(5).fill(textos[5]));
    expect(textos[0]).not.toBe(textos[5]);
    expect(ordenes).toEqual([1, 2, 3, 4, 5, 1, 2, 3, 4, 5]);
  });

  it('CP-44: inicia Lectora sin dificultad con cinco y muestra el texto sin claves', async () => {
    const textoId = await crearTextoDePrueba(entorno.bd);
    for (let orden = 1; orden <= 5; orden++)
      await crearPreguntaPublicada(entorno.bd, {
        prueba: 'CL',
        dificultad: 'media',
        textoId,
        ordenEnTexto: orden,
      });
    const { token } = await sesion('clcinco@ejemplo.cl', [lectoraId]);
    const creada = await inicio(token, { pruebaId: lectoraId, cantidad: 5 });
    expect(creada.status).toBe(201);
    expect(creada.body.data.dificultad).toBe('mezcla');
    for (let orden = 1; orden <= 5; orden++) {
      const entrega = await siguiente(token, creada.body.data.id as string);
      expect(entrega.status).toBe(200);
      expect(entrega.body.data).toMatchObject({ orden, total: 5 });
      expect(entrega.body.data.texto).toEqual({
        titulo: 'Texto de prueba',
        contenido: 'Un texto para la práctica.',
        imagen: null,
      });
      expect(JSON.stringify(entrega.body)).not.toMatch(
        /alternativaCorrectaId|esCorrecta|explicacion|Explicación reservada/i,
      );
      await responder(entrega.body.data.id as string);
    }
  });
});
