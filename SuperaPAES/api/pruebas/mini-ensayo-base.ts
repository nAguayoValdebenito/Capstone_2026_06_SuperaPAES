import request from 'supertest';
import { prepararPracticas } from './base-practicas.js';
import { crearPreguntaPublicada } from './preguntas-de-prueba.js';

export function prepararMini(prefijo: string) {
  const base = prepararPracticas(prefijo);
  const { entorno } = base;
  const iniciar = (token: string, pruebaId = base.pruebaId) =>
    request(entorno.app)
      .post('/api/v1/app/evaluaciones/mini-ensayos')
      .set('Authorization', `Bearer ${token}`)
      .send({ pruebaId });
  const entregar = (token: string, id: string | number) =>
    request(entorno.app)
      .post(`/api/v1/app/evaluaciones/${id}/entregar`)
      .set('Authorization', `Bearer ${token}`)
      .send();

  async function banco(prueba = 'M1', porDificultad = 6) {
    const { rows } = await entorno.bd.query<{ id: number; ejeId: number; areaId: number }>(
      `SELECT DISTINCT ON(c.eje_id) c.id, c.eje_id AS "ejeId", c.area_id AS "areaId"
       FROM contenido.contenido_tematico c JOIN contenido.prueba p ON p.id=c.prueba_id
       WHERE p.codigo=$1 AND c.activo ORDER BY c.eje_id,c.id`,
      [prueba],
    );
    for (const c of rows)
      for (const dificultad of ['facil', 'media', 'dificil'] as const)
        for (let i = 0; i < porDificultad; i++)
          await crearPreguntaPublicada(entorno.bd, { prueba, dificultad, contenidoId: c.id });
    return rows;
  }
  async function estado(id: string | number) {
    const { rows } = await entorno.bd.query<{ codigo: string }>(
      'SELECT s.codigo FROM app.evaluacion e JOIN contenido.estado_evaluacion s ON s.id=e.estado_evaluacion_id WHERE e.id=$1',
      [id],
    );
    return rows[0]?.codigo;
  }
  async function cantidades(estudianteId: string) {
    const { rows } = await entorno.bd.query<{ evaluaciones: number; usos: number }>(
      `SELECT (SELECT count(*)::int FROM app.evaluacion WHERE estudiante_id=$1) AS evaluaciones,
       (SELECT count(*)::int FROM app.uso_gratis WHERE estudiante_id=$1) AS usos`,
      [estudianteId],
    );
    return rows[0];
  }
  async function repasoRespondido(token: string, estudianteId: string) {
    const practica = await base.inicio(token, {
      pruebaId: base.pruebaId,
      cantidad: 5,
      dificultadId: base.mediaId,
    });
    const p = await base.siguiente(token, String(practica.body.data.id));
    await entorno.bd.query(
      `UPDATE app.evaluacion_item i SET alternativa_id=a.id,respondida_en=now(),tipo_consumo_id=t.id
      FROM contenido.alternativa a,contenido.tipo_consumo t WHERE i.id=$1 AND a.pregunta_id=i.pregunta_id AND a.letra='B' AND t.codigo='cupo'`,
      [p.body.data.id],
    );
    await entorno.bd.query("SELECT app.cerrar_evaluacion($1,'entregada')", [practica.body.data.id]);
    const id = await base.crearEvaluacionAbierta('repaso', estudianteId, base.pruebaId);
    await entorno.bd.query(
      `INSERT INTO app.evaluacion_item (evaluacion_id,prueba_id,pregunta_id,version_pregunta,orden)
      SELECT $1,prueba_id,pregunta_id,version_pregunta,1 FROM app.evaluacion_item WHERE id=$2`,
      [id, p.body.data.id],
    );
    await entorno.bd.query(
      `UPDATE app.evaluacion_item i SET alternativa_id=a.id,respondida_en=now()
      FROM contenido.alternativa a WHERE i.evaluacion_id=$1 AND a.pregunta_id=i.pregunta_id AND a.letra='A'`,
      [id],
    );
    return id;
  }
  return { base, entorno, iniciar, entregar, banco, estado, cantidades, repasoRespondido };
}
