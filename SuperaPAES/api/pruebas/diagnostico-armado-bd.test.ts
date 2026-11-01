import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prepararMini } from './mini-ensayo-base.js';
import { crearPreguntaPublicada, crearTextoDePrueba } from './preguntas-de-prueba.js';

describe.skipIf(!process.env['DATABASE_URL_PRUEBAS'])('armado del diagnóstico (HU-36.3)', () => {
  const m = prepararMini('diagnostico_armado');
  const { base, entorno } = m;
  const iniciar = (token: string, pruebaId: number) =>
    request(entorno.app)
      .post('/api/v1/app/evaluaciones/diagnosticos')
      .set('Authorization', `Bearer ${token}`)
      .send({ pruebaId });

  it('omite el eje posterior al curso y redistribuye sus 5 preguntas', async () => {
    const { rows: ejes } = await entorno.bd.query<{ id: number }>(
      'SELECT id FROM contenido.eje_tematico WHERE prueba_id=$1 ORDER BY orden',
      [base.pruebaId],
    );
    await entorno.bd.query(
      `UPDATE contenido.contenido_tematico SET nivel_escolar_id=(
        SELECT id FROM contenido.nivel_escolar WHERE anios_para_egreso=CASE WHEN eje_id=$2 THEN 0 ELSE 3 END)
       WHERE prueba_id=$1`,
      [base.pruebaId, ejes[3]!.id],
    );
    await m.banco();
    const { token } = await base.sesion(undefined, undefined, 2029);
    const r = await iniciar(token, base.pruebaId);
    expect(r.status).toBe(201);
    expect(r.body.data.cantidad).toBe(20);
    const { rows } = await entorno.bd.query<{ eje: number; total: number }>(
      `SELECT v.eje_id AS eje,count(*)::int AS total FROM app.evaluacion_item i
       JOIN contenido.pregunta_version v ON (v.pregunta_id,v.version)=(i.pregunta_id,i.version_pregunta)
       WHERE i.evaluacion_id=$1 GROUP BY v.eje_id`,
      [r.body.data.id],
    );
    expect(rows.map((e) => e.total).sort((a, b) => a - b)).toEqual([6, 7, 7]);
    expect(rows.some((e) => e.eje === ejes[3]!.id)).toBe(false);
  });

  it('Ciencias arma 5 por eje sin electivo registrado', async () => {
    await m.banco('CIE');
    const { rows: pruebas } = await entorno.bd.query<{ id: number }>(
      "SELECT id FROM contenido.prueba WHERE codigo='CIE'",
    );
    const pruebaId = pruebas[0]!.id;
    const { token } = await base.sesion(undefined, [pruebaId], 2020);
    const r = await iniciar(token, pruebaId);
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ cantidad: 15, duracionMin: 30 });
    const { rows } = await entorno.bd.query<{ eje: number; total: number }>(
      `SELECT v.eje_id AS eje,count(*)::int AS total FROM app.evaluacion_item i
       JOIN contenido.pregunta_version v ON (v.pregunta_id,v.version)=(i.pregunta_id,i.version_pregunta)
       WHERE i.evaluacion_id=$1 GROUP BY v.eje_id`,
      [r.body.data.id],
    );
    expect(rows.map((e) => e.total).sort()).toEqual([5, 5, 5]);
  });

  it('Lectora usa dos textos completos y cinco preguntas por habilidad', async () => {
    const { rows: habilidades } = await entorno.bd.query<{ id: number }>(
      'SELECT id FROM contenido.habilidad WHERE prueba_id=$1 ORDER BY id',
      [base.lectoraId],
    );
    const dificultades = [
      'facil',
      'facil',
      'media',
      'media',
      'media',
      'dificil',
      'dificil',
      'media',
      'media',
      'facil',
      'facil',
      'dificil',
      'media',
      'media',
      'dificil',
    ] as const;
    for (const [texto, cantidad] of [9, 6].entries()) {
      const textoId = await crearTextoDePrueba(entorno.bd);
      const desde = texto === 0 ? 0 : 9;
      for (let i = 0; i < cantidad; i++)
        await crearPreguntaPublicada(entorno.bd, {
          prueba: 'CL',
          dificultad: dificultades[desde + i]!,
          textoId,
          ordenEnTexto: i + 1,
          habilidadId: habilidades[i % 3]!.id,
        });
    }
    const { token } = await base.sesion(undefined, [base.lectoraId], 2020);
    const r = await iniciar(token, base.lectoraId);
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ cantidad: 15, duracionMin: 35 });
    const { rows } = await entorno.bd.query<{ habilidad: number; total: number }>(
      `SELECT v.habilidad_id AS habilidad,count(*)::int AS total FROM app.evaluacion_item i
       JOIN contenido.pregunta_version v ON (v.pregunta_id,v.version)=(i.pregunta_id,i.version_pregunta)
       WHERE i.evaluacion_id=$1 GROUP BY v.habilidad_id`,
      [r.body.data.id],
    );
    expect(rows.map((e) => e.total).sort()).toEqual([5, 5, 5]);
    const { rows: textos } = await entorno.bd.query<{ id: string; total: number }>(
      `SELECT p.texto_estimulo_id::text AS id,count(*)::int AS total
       FROM app.evaluacion_item i JOIN contenido.pregunta p ON p.id=i.pregunta_id
       WHERE i.evaluacion_id=$1 GROUP BY p.texto_estimulo_id`,
      [r.body.data.id],
    );
    expect(textos.map((t) => t.total).sort((a, b) => a - b)).toEqual([6, 9]);
    expect((await m.entregar(token, Number(r.body.data.id))).status).toBe(200);
    const resultado = await request(entorno.app)
      .get(`/api/v1/app/evaluaciones/${r.body.data.id}/resultado`)
      .set('Authorization', `Bearer ${token}`);
    expect(resultado.body.data.ejesAReforzar).toEqual([]);
    expect(resultado.body.data.habilidadesAReforzar).toHaveLength(3);
  });
});
