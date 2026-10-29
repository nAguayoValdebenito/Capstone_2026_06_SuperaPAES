// HU-61.1 (RF-A23, RN-21 a RN-23, CU-29): resultado y revisión pregunta por pregunta contra PostgreSQL
// real. Las prácticas se hacen por HTTP; las evaluaciones con tiempo (que todavía no tienen ruta para
// empezar, HU-40) se arman en la base y se cierran con cerrar_evaluacion, como lo hará la entrega.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import {
  crearPreguntaPublicada,
  publicarPreguntaDePrueba,
  type PreguntaDePrueba,
} from './preguntas-de-prueba.js';
import { prepararRespuestas } from './respuestas-de-prueba.js';

const RUTA = '/api/v1/app/evaluaciones';

exigirBaseEnCi();
describe.skipIf(!urlBase)('resultado y revisión de una evaluación con PostgreSQL (HU-61.1)', () => {
  const r = prepararRespuestas('resultado');
  const { base, entorno } = r;

  const consultar = (token: string, id: string, que: 'resultado' | 'revision') =>
    request(entorno.app).get(`${RUTA}/${id}/${que}`).set('Authorization', `Bearer ${token}`);

  /**
   * Arma un mini-ensayo o un ensayo de M1 con esas preguntas, que empezó hace `haceMin` minutos.
   * El ensayo usa la tabla de conversión más reciente de M1 (RN-23).
   */
  async function evaluacionConTiempo(
    estudianteId: string,
    tipo: 'mini_ensayo' | 'ensayo',
    preguntas: PreguntaDePrueba[],
    haceMin = 0,
  ): Promise<string[]> {
    const { rows } = await entorno.bd.query<{ id: string }>(
      `INSERT INTO app.evaluacion
       (estudiante_id, tipo_evaluacion_id, unica_por_anio_escolar, prueba_id, estructura_id,
        anio_escolar, cantidad_preguntas, duracion_min, estado_evaluacion_id, iniciada_en, vence_en,
        tabla_conversion_id)
       SELECT $1, t.id, t.unica_por_anio_escolar, $2, s.id, 0, $4, s.duracion_min, e.id,
         now() - $5 * INTERVAL '1 minute',
         now() - $5 * INTERVAL '1 minute' + s.duracion_min * INTERVAL '1 minute',
         CASE WHEN t.entrega_puntaje THEN (SELECT id FROM contenido.tabla_conversion
           WHERE prueba_id = $2 ORDER BY anio_admision DESC LIMIT 1) END
       FROM contenido.tipo_evaluacion t
       JOIN contenido.estructura_evaluacion s ON s.tipo_evaluacion_id = t.id AND s.prueba_id = $2
       CROSS JOIN contenido.estado_evaluacion e
       WHERE t.codigo = $3 AND e.codigo = 'en_curso'
       RETURNING id::text`,
      [estudianteId, base.pruebaId, tipo, preguntas.length, haceMin],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('Falta la estructura de la evaluación de prueba.');
    const items: string[] = [];
    for (const [indice, pregunta] of preguntas.entries()) {
      const { rows: item } = await entorno.bd.query<{ id: string }>(
        `INSERT INTO app.evaluacion_item (evaluacion_id, prueba_id, pregunta_id, version_pregunta, orden)
         VALUES ($1, $2, $3, $4, $5) RETURNING id::text`,
        [id, base.pruebaId, pregunta.preguntaId, pregunta.version, indice + 1],
      );
      items.push(item[0]?.id ?? '');
    }
    return [id, ...items];
  }

  /** Responde el ítem con esa letra (la A es la correcta), sin corregir: se corrige al cerrar. */
  async function marcar(itemId: string, letra: string) {
    await entorno.bd.query(
      `UPDATE app.evaluacion_item i SET alternativa_id = a.id, respondida_en = now()
       FROM contenido.alternativa a WHERE i.id = $1 AND a.pregunta_id = i.pregunta_id AND a.letra = $2`,
      [itemId, letra],
    );
  }

  const entregar = (id: string) =>
    entorno.bd.query("SELECT app.cerrar_evaluacion($1, 'entregada')", [id]);

  async function publicadas(cantidad: number) {
    const preguntas: PreguntaDePrueba[] = [];
    for (let i = 0; i < cantidad; i++)
      preguntas.push(
        await crearPreguntaPublicada(entorno.bd, { prueba: 'M1', dificultad: 'media' }),
      );
    return preguntas;
  }

  it('práctica: resultado guardado y revisión solo de las respondidas (RN-22)', async () => {
    await base.publicar(5, { prueba: 'M1', dificultad: 'media' });
    const { token } = await base.sesion();
    const primera = await r.practicaConPregunta(token, 5);
    await r.responderCon(token, primera, 'A');
    const segunda = { ...primera, itemId: await r.entregar(token, primera.practicaId) };
    await r.responderCon(token, segunda, 'B');
    await r.entregar(token, primera.practicaId); // la tercera queda sin responder
    expect((await base.cerrar(token, primera.practicaId)).status).toBe(200);

    const resultado = await consultar(token, primera.practicaId, 'resultado');
    const revision = await consultar(token, primera.practicaId, 'revision');

    expect(resultado.status).toBe(200);
    expect(resultado.body.data).toMatchObject({
      id: Number(primera.practicaId),
      tipo: { codigo: 'practica', nombre: 'Práctica' },
      prueba: { id: base.pruebaId, codigo: 'M1' },
      estado: { codigo: 'entregada' },
      duracionMin: null,
      cantidad: 5,
      puntuables: 2,
      correctas: 1,
      incorrectas: 1,
      omitidas: 0,
      porcentaje: 50,
      puntaje: null,
      tablaConversion: null,
      recalculadoEn: null,
    });
    expect(resultado.body.data.ejes).toEqual([
      expect.objectContaining({ preguntas: 2, correctas: 1 }),
    ]);
    expect(revision.status).toBe(200);
    const [acertada, fallada, ...resto] = revision.body.data.preguntas;
    expect(resto).toEqual([]);
    expect(acertada).toMatchObject({ orden: 1, resultado: 'correcta', puntuable: true });
    expect(acertada.alternativaElegidaId).toBe(acertada.alternativaCorrectaId);
    expect(fallada).toMatchObject({
      orden: 2,
      resultado: 'incorrecta',
      enunciado: 'Enunciado de prueba',
      explicacion: 'Explicación reservada',
      texto: null,
    });
    expect(fallada.alternativas).toHaveLength(4);
    expect(fallada.alternativas[1]).toMatchObject({
      id: fallada.alternativaElegidaId,
      letra: 'B',
      explicacion: 'Explicación B',
    });
    expect(typeof fallada.preguntaId).toBe('number');
    expect(typeof fallada.eje.id).toBe('number');
  });

  it('mini-ensayo: las sin responder son omitidas y la revisión muestra la versión que vio', async () => {
    const { id: estudianteId, token } = await base.sesion();
    const preguntas = await publicadas(3);
    const [id = '', bien = '', mal = ''] = await evaluacionConTiempo(
      estudianteId,
      'mini_ensayo',
      preguntas,
    );
    await marcar(bien, 'A');
    await marcar(mal, 'C');
    await entregar(id);
    // Después la pregunta 1 se corrige y se vuelve a publicar como versión nueva.
    const editada = preguntas[0]?.preguntaId;
    for (const estado of ['retirada', 'borrador'])
      await entorno.bd.query(
        `UPDATE contenido.pregunta SET estado_pregunta_id = e.id FROM contenido.estado_pregunta e
         WHERE pregunta.id = $1 AND e.codigo = $2`,
        [editada, estado],
      );
    await entorno.bd.query(
      "UPDATE contenido.pregunta SET enunciado = 'Enunciado nuevo' WHERE id = $1",
      [editada],
    );
    await publicarPreguntaDePrueba(entorno.bd, editada ?? '', 'media');

    const resultado = await consultar(token, id, 'resultado');
    const revision = await consultar(token, id, 'revision');

    expect(resultado.body.data).toMatchObject({
      tipo: { codigo: 'mini_ensayo' },
      estado: { codigo: 'entregada' },
      duracionMin: 48,
      puntuables: 3,
      correctas: 1,
      incorrectas: 1,
      omitidas: 1,
      porcentaje: 33.3,
      puntaje: null,
    });
    const items = revision.body.data.preguntas as Record<string, unknown>[];
    expect(items.map((p) => p.resultado)).toEqual(['correcta', 'incorrecta', 'omitida']);
    expect(items[0]?.enunciado).toBe('Enunciado de prueba');
    expect(items[2]?.alternativaElegidaId).toBeNull();
  });

  it('ensayo: el puntaje estimado indica el año y el proceso de su tabla (RN-23)', async () => {
    // La base de sesiones vacía usuario_interno con CASCADE, que se lleva las tablas de las semillas
    // (cargada_por): se carga una de M1 de 0 a 2 correctas.
    await entorno.bd.query(
      `WITH tc AS (
         INSERT INTO contenido.tabla_conversion (prueba_id, proceso_admision_id, anio_admision, publicada_en)
         SELECT $1, pa.id, 2026, DATE '2026-01-05' FROM contenido.proceso_admision pa
          WHERE pa.codigo = 'regular' ON CONFLICT DO NOTHING RETURNING id)
       INSERT INTO contenido.tabla_conversion_fila (tabla_conversion_id, correctas, puntaje)
       SELECT tc.id, f.c, f.p FROM tc, (VALUES (0, 100), (1, 400), (2, 700)) f(c, p)`,
      [base.pruebaId],
    );
    const { id: estudianteId, token } = await base.sesion();
    const [id = '', ...items] = await evaluacionConTiempo(
      estudianteId,
      'ensayo',
      await publicadas(2),
    );
    for (const item of items) await marcar(item, 'A');
    await entregar(id);

    const resultado = await consultar(token, id, 'resultado');

    expect(resultado.body.data).toMatchObject({
      tipo: { codigo: 'ensayo' },
      correctas: 2,
      porcentaje: 100,
      puntaje: 700,
      tablaConversion: { anioAdmision: 2026, proceso: 'Regular' },
    });
  });

  it('una evaluación con el tiempo cumplido se cierra al consultarla (RN-21)', async () => {
    const { id: estudianteId, token } = await base.sesion();
    const [id = ''] = await evaluacionConTiempo(
      estudianteId,
      'mini_ensayo',
      await publicadas(2),
      60,
    );

    const resultado = await consultar(token, id, 'resultado');

    expect(resultado.status).toBe(200);
    expect(resultado.body.data).toMatchObject({
      estado: { codigo: 'tiempo_agotado' },
      omitidas: 2,
      tiempoUsadoSeg: 48 * 60,
    });
    const revision = await consultar(token, id, 'revision');
    expect(revision.body.data.preguntas).toHaveLength(2);
  });

  it('abierta y en tiempo, de otro estudiante o inexistente, no se consulta', async () => {
    const { id: estudianteId, token } = await base.sesion();
    const otro = await base.sesion('otro@ejemplo.cl');
    const [id = ''] = await evaluacionConTiempo(estudianteId, 'mini_ensayo', await publicadas(1));

    const abierta = await consultar(token, id, 'revision');
    const ajena = await consultar(otro.token, id, 'resultado');
    const inexistente = await consultar(token, '999999', 'resultado');
    const sinSesion = await request(entorno.app).get(`${RUTA}/${id}/resultado`);

    expect(abierta.status).toBe(409);
    expect(abierta.body.error.codigo).toBe('EVALUACION_ABIERTA');
    for (const respuesta of [ajena, inexistente]) {
      expect(respuesta.status).toBe(404);
      expect(respuesta.body.error.codigo).toBe('EVALUACION_NO_ENCONTRADA');
    }
    expect(sinSesion.status).toBe(401);
  });
});
