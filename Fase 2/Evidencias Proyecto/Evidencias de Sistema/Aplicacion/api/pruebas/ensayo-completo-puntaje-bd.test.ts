import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prepararMini } from './mini-ensayo-base.js';
import { insertarSuscripcion } from './suscripciones-de-prueba.js';

describe.skipIf(!process.env['DATABASE_URL_PRUEBAS'])('ensayo completo: puntaje (HU-42.2)', () => {
  const m = prepararMini('ensayo_puntaje');
  const { base, entorno } = m;
  const iniciar = (token: string) =>
    request(entorno.app)
      .post('/api/v1/app/evaluaciones/ensayos')
      .set('Authorization', `Bearer ${token}`)
      .send({ pruebaId: base.pruebaId });
  const resultado = (token: string, id: string) =>
    request(entorno.app)
      .get(`/api/v1/app/evaluaciones/${id}/resultado`)
      .set('Authorization', `Bearer ${token}`);

  async function tabla(anio: number, publicada: string, factor: number) {
    const {
      rows: [t],
    } = await entorno.bd.query<{ id: number }>(
      `INSERT INTO contenido.tabla_conversion
        (prueba_id,proceso_admision_id,anio_admision,publicada_en)
       SELECT $1,p.id,$2,$3::date FROM contenido.proceso_admision p WHERE p.codigo='regular'
       RETURNING id`,
      [base.pruebaId, anio, publicada],
    );
    await entorno.bd.query(
      `INSERT INTO contenido.tabla_conversion_fila (tabla_conversion_id,correctas,puntaje)
       SELECT $1,g,100+g*$2 FROM generate_series(0,60) g`,
      [t!.id, factor],
    );
    return t!.id;
  }

  async function preparado() {
    await m.banco('M1', 8);
    const { id, token } = await base.sesion(undefined, undefined, 2029);
    await insertarSuscripcion(entorno.bd, {
      estudianteId: id,
      plan: 'Todas las pruebas mensual',
      estado: 'activa',
    });
    return { token };
  }

  it('fija la tabla al inicio, escala tras anulación y conserva la estimación al consultar', async () => {
    const { token } = await preparado();
    const primera = await tabla(2026, '2026-01-05', 15);
    const inicio = await iniciar(token);
    expect(inicio.status).toBe(201);
    const id = String(inicio.body.data.id);
    const {
      rows: [fijada],
    } = await entorno.bd.query<{ tabla: number }>(
      'SELECT tabla_conversion_id AS tabla FROM app.evaluacion WHERE id=$1',
      [id],
    );
    expect(fijada!.tabla).toBe(primera);
    await tabla(2027, '2027-01-05', 10);
    const { rows: items } = await entorno.bd.query<{ id: string; preguntaId: string }>(
      'SELECT id::text,pregunta_id::text AS "preguntaId" FROM app.evaluacion_item WHERE evaluacion_id=$1 AND puntuable ORDER BY orden',
      [id],
    );
    for (const item of items.slice(0, 30))
      await entorno.bd.query(
        `UPDATE app.evaluacion_item i SET alternativa_id=a.id,respondida_en=now()
         FROM contenido.alternativa a WHERE i.id=$1 AND a.pregunta_id=i.pregunta_id AND a.letra='A'`,
        [item.id],
      );
    await entorno.bd.query(
      `UPDATE app.evaluacion_item i SET alternativa_id=a.id,respondida_en=now()
       FROM contenido.alternativa a WHERE i.id=$1 AND a.pregunta_id=i.pregunta_id AND a.letra='B'`,
      [items[30]!.id],
    );
    expect((await m.entregar(token, id)).status).toBe(200);
    const antes = await resultado(token, id);
    expect(antes.body.data).toMatchObject({
      puntuables: 60,
      correctas: 30,
      incorrectas: 1,
      omitidas: 29,
      puntaje: 550,
      tablaConversion: { anioAdmision: 2026, proceso: 'Regular' },
    });
    await entorno.bd.query('SELECT app.anular_pregunta($1)', [items[30]!.preguntaId]);
    const despues = await resultado(token, id);
    expect(despues.body.data).toMatchObject({
      puntuables: 59,
      correctas: 30,
      incorrectas: 0,
      puntaje: 565,
      tablaConversion: { anioAdmision: 2026 },
    });
    expect((await resultado(token, id)).body.data).toEqual(despues.body.data);
  });

  it('sin tabla permite rendir y entrega resultado sin puntaje estimado', async () => {
    const { token } = await preparado();
    const inicio = await iniciar(token);
    expect(inicio.status).toBe(201);
    const id = String(inicio.body.data.id);
    expect((await m.entregar(token, id)).status).toBe(200);
    const r = await resultado(token, id);
    expect(r.body.data).toMatchObject({
      puntaje: null,
      tablaConversion: null,
      motivoSinPuntaje: 'tabla_no_disponible',
    });
  });

  it('Ciencias fija la tabla del electivo elegido', async () => {
    const contenidos = await m.banco('CIE', 20);
    const {
      rows: [prueba],
    } = await entorno.bd.query<{ id: number }>(
      "SELECT id FROM contenido.prueba WHERE codigo='CIE'",
    );
    const electivo = contenidos[0]!.areaId;
    const otro = contenidos.find((c) => c.areaId !== electivo)!.areaId;
    const { id, token } = await base.sesion(undefined, [prueba!.id], 2029);
    await insertarSuscripcion(entorno.bd, {
      estudianteId: id,
      plan: 'Todas las pruebas mensual',
      estado: 'activa',
    });
    await entorno.bd.query(
      'UPDATE app.estudiante_prueba SET electivo_area_id=$2 WHERE estudiante_id=$1 AND prueba_id=$3',
      [id, electivo, prueba!.id],
    );
    const ids = [];
    for (const area of [otro, electivo]) {
      const {
        rows: [t],
      } = await entorno.bd.query<{ id: number }>(
        `INSERT INTO contenido.tabla_conversion
         (prueba_id,proceso_admision_id,anio_admision,electivo_area_id,publicada_en)
         SELECT $1,p.id,2026,$2,DATE '2026-01-05' FROM contenido.proceso_admision p
         WHERE p.codigo='regular' RETURNING id`,
        [prueba!.id, area],
      );
      ids.push(t!.id);
      await entorno.bd.query(
        `INSERT INTO contenido.tabla_conversion_fila
         SELECT $1,g,100+g*12 FROM generate_series(0,75) g`,
        [t!.id],
      );
    }
    const inicio = await request(entorno.app)
      .post('/api/v1/app/evaluaciones/ensayos')
      .set('Authorization', `Bearer ${token}`)
      .send({ pruebaId: prueba!.id });
    expect(inicio.status).toBe(201);
    const {
      rows: [evaluacion],
    } = await entorno.bd.query<{ tabla: number }>(
      'SELECT tabla_conversion_id AS tabla FROM app.evaluacion WHERE id=$1',
      [inicio.body.data.id],
    );
    expect(evaluacion!.tabla).toBe(ids[1]);
  });
});
