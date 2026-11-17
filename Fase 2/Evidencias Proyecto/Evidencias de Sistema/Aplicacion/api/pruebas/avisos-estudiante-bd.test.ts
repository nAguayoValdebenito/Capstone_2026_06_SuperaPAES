// Avisos de error del estudiante contra PostgreSQL real (HU-37, RF-A16, CU-13, A23; base temporal _test).
// El aviso se envía sobre un ítem entregado en una práctica y queda pendiente en app.reporte_pregunta
// con la versión que vio el estudiante. Límites de docs/planes/hu-37-avisar-error.md (D4).
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararRespuestas, type PreguntaEntregada } from './respuestas-de-prueba.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('avisar un error con PostgreSQL (HU-37)', () => {
  const r = prepararRespuestas('avisos_estudiante');
  const { base, entorno } = r;
  const CUERPO = { motivo: 'respuesta', comentario: 'Creo que la correcta es la C.' };

  beforeEach(async () => {
    await base.publicar(6, { prueba: 'M1', dificultad: 'media' });
  });

  const avisar = (token: string, { practicaId, itemId }: PreguntaEntregada, cuerpo = CUERPO) =>
    request(entorno.app)
      .post(`/api/v1/app/evaluaciones/${practicaId}/items/${itemId}/avisos`)
      .set('Authorization', `Bearer ${token}`)
      .send(cuerpo);

  /** Los avisos guardados del estudiante, con la versión del ítem para compararla. */
  async function avisosDe(estudianteId: string) {
    const { rows } = await entorno.bd.query<Record<string, unknown>>(
      `SELECT r.pregunta_id::text AS pregunta, r.version_pregunta AS version, m.codigo AS motivo,
              r.comentario, e.codigo AS estado
         FROM app.reporte_pregunta r
         JOIN contenido.motivo_reporte m ON m.id = r.motivo_reporte_id
         JOIN contenido.estado_reporte e ON e.id = r.estado_reporte_id
        WHERE r.estudiante_id = $1 ORDER BY r.id`,
      [estudianteId],
    );
    return rows;
  }

  async function itemDe({ itemId }: PreguntaEntregada) {
    const { rows } = await entorno.bd.query<{ pregunta: string; version: number }>(
      `SELECT pregunta_id::text AS pregunta, version_pregunta AS version
         FROM app.evaluacion_item WHERE id = $1`,
      [itemId],
    );
    const item = rows[0];
    if (!item) throw new Error('No existe el ítem de prueba.');
    return item;
  }

  it('entrega los cinco motivos de la lista', async () => {
    const { token } = await base.sesion();
    const respuesta = await request(entorno.app)
      .get('/api/v1/app/preguntas/avisos/motivos')
      .set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(200);
    const motivos = respuesta.body.data as { codigo: string }[];
    expect(motivos.map((m) => m.codigo)).toEqual([
      'enunciado',
      'alternativas',
      'respuesta',
      'explicacion',
      'otro',
    ]);
  });

  it('guarda el aviso pendiente con la pregunta y la versión del ítem, antes de responder', async () => {
    const { id, token } = await base.sesion();
    const pregunta = await r.practicaConPregunta(token);

    const respuesta = await avisar(token, pregunta);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toEqual({
      id: expect.any(String) as string,
      motivo: { codigo: 'respuesta', nombre: 'La respuesta correcta está mal' },
      estado: { codigo: 'pendiente', nombre: 'Pendiente' },
      creadoEn: expect.any(String) as string,
    });
    const item = await itemDe(pregunta);
    expect(await avisosDe(id)).toEqual([
      { ...item, motivo: 'respuesta', comentario: CUERPO.comentario, estado: 'pendiente' },
    ]);
  });

  it('un segundo aviso de la misma pregunta espera a que se cierre el primero', async () => {
    const { id, token } = await base.sesion();
    const pregunta = await r.practicaConPregunta(token);
    expect((await avisar(token, pregunta)).status).toBe(201);

    const repetido = await avisar(token, pregunta, { motivo: 'otro', comentario: 'Otra cosa.' });
    expect(repetido.status).toBe(409);
    expect(repetido.body.error.codigo).toBe('CONFLICTO');

    await entorno.bd.query(
      `UPDATE app.reporte_pregunta SET resuelto_en = now(),
              estado_reporte_id = (SELECT id FROM contenido.estado_reporte WHERE codigo = 'descartado')
        WHERE estudiante_id = $1`,
      [id],
    );
    expect((await avisar(token, pregunta)).status).toBe(201);
    expect(await avisosDe(id)).toHaveLength(2);
  });

  it('dos envíos a la vez guardan un solo aviso', async () => {
    const { id, token } = await base.sesion();
    const pregunta = await r.practicaConPregunta(token);
    const estados = (await Promise.all([avisar(token, pregunta), avisar(token, pregunta)])).map(
      (respuesta) => respuesta.status,
    );
    expect(estados.sort()).toEqual([201, 409]);
    expect(await avisosDe(id)).toHaveLength(1);
  });

  it('el ítem de otro estudiante da 404 y no guarda nada', async () => {
    const ana = await base.sesion('ana@ejemplo.cl');
    const beto = await base.sesion('beto@ejemplo.cl');
    const deAna = await r.practicaConPregunta(ana.token);

    const respuesta = await avisar(beto.token, deAna);

    expect(respuesta.status).toBe(404);
    expect(await avisosDe(beto.id)).toEqual([]);
    expect(await avisosDe(ana.id)).toEqual([]);
  });

  it('un motivo que no existe da 400 y no guarda nada', async () => {
    const { id, token } = await base.sesion();
    const pregunta = await r.practicaConPregunta(token);
    const respuesta = await avisar(token, pregunta, { motivo: 'inventado', comentario: 'Algo.' });
    expect(respuesta.status).toBe(400);
    expect(await avisosDe(id)).toEqual([]);
  });

  it('después de 10 avisos en 24 horas responde 429', async () => {
    const { id, token } = await base.sesion();
    const pregunta = await r.practicaConPregunta(token);
    const item = await itemDe(pregunta);
    await entorno.bd.query(
      `INSERT INTO app.reporte_pregunta (estudiante_id, pregunta_id, version_pregunta, motivo_reporte_id,
                                         comentario, estado_reporte_id, creado_en, resuelto_en)
       SELECT $1, $2, $3, m.id, 'Aviso anterior.', e.id, now() - interval '1 hour', now()
         FROM generate_series(1, 10), contenido.motivo_reporte m, contenido.estado_reporte e
        WHERE m.codigo = 'otro' AND e.codigo = 'descartado'`,
      [id, item.pregunta, item.version],
    );

    const respuesta = await avisar(token, pregunta);

    expect(respuesta.status).toBe(429);
    expect(await avisosDe(id)).toHaveLength(10);
  });
});
