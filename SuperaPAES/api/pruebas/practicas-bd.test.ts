// HU-30.1 y HU-31.2: rutas y validaciones de la práctica sobre PostgreSQL temporal.
import { beforeAll, describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararPracticas } from './base-practicas.js';
import { crearPreguntaPublicada } from './preguntas-de-prueba.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('prácticas con PostgreSQL (CP-44 y CP-20)', () => {
  const base = prepararPracticas('practicas');
  const { entorno, sesion, contenido, publicar, inicio, siguiente, responder } = base;
  let pruebaId: number;
  let lectoraId: number;
  let mediaId: number;
  let dificilId: number;
  beforeAll(() => {
    ({ pruebaId, lectoraId, mediaId, dificilId } = base);
  });

  it('inicia cinco preguntas y entrega una sola al pedir siguiente dos veces', async () => {
    for (let i = 0; i < 5; i++) {
      await crearPreguntaPublicada(entorno.bd, { prueba: 'M1', dificultad: 'media' });
    }
    const { token } = await sesion();
    const creada = await inicio(token, { pruebaId, cantidad: 5 });
    expect(creada.status).toBe(201);
    expect(creada.body.data).toMatchObject({ pruebaId, cantidad: 5, entregadas: 0 });
    const id = creada.body.data.id as string;
    const primera = await siguiente(token, id);
    const [segunda, tercera] = await Promise.all([siguiente(token, id), siguiente(token, id)]);
    expect(primera.status).toBe(200);
    expect(segunda.body).toEqual(primera.body);
    expect(tercera.body).toEqual(primera.body);
    expect(primera.body.data).toMatchObject({ orden: 1, total: 5 });
    expect(primera.body.data.alternativas).toEqual(
      expect.arrayContaining([{ id: expect.any(Number), letra: 'A', texto: 'Alternativa A' }]),
    );
    expect(JSON.stringify(primera.body)).not.toMatch(
      /esCorrecta|alternativaCorrectaId|explicacion|Explicación reservada/i,
    );
    const { rows } = await entorno.bd.query<{ total: number }>(
      'SELECT count(*)::int AS total FROM app.evaluacion_item WHERE evaluacion_id=$1',
      [id],
    );
    expect(rows[0]?.total).toBe(1);
  });

  it('CP-44: inicia un eje de M1 con diez medias y las entrega sin duplicar ni saltar orden', async () => {
    const { ejeId, id: contenidoId } = await contenido(pruebaId);
    await publicar(10, { prueba: 'M1', dificultad: 'media', contenidoId });
    const { token } = await sesion();
    const creada = await inicio(token, { pruebaId, ejeId, dificultadId: mediaId, cantidad: 10 });
    expect(creada.status).toBe(201);
    expect(creada.body.data).toMatchObject({
      ejeId,
      dificultadId: mediaId,
      dificultad: 'media',
      entregadas: 0,
    });
    const id = creada.body.data.id as string;
    const recibidas = new Set<string>();
    for (let orden = 1; orden <= 10; orden++) {
      const entrega = await siguiente(token, id);
      expect(entrega.status).toBe(200);
      expect(entrega.body.data).toMatchObject({ orden, total: 10 });
      const itemId = entrega.body.data.id as string;
      const { rows } = await entorno.bd.query<{ preguntaId: string }>(
        'SELECT pregunta_id::text AS "preguntaId" FROM app.evaluacion_item WHERE id=$1',
        [itemId],
      );
      const preguntaId = rows[0]?.preguntaId ?? '';
      expect(recibidas.has(preguntaId)).toBe(false);
      recibidas.add(preguntaId);
      await responder(itemId);
    }
    expect(recibidas.size).toBe(10);
    const completa = await siguiente(token, id);
    expect(completa.status).toBe(409);
    expect(completa.body.error.codigo).toBe('PRACTICA_COMPLETA');
    const { rows } = await entorno.bd.query<{ distintas: number }>(
      'SELECT count(DISTINCT pregunta_id)::int AS distintas FROM app.evaluacion_item WHERE evaluacion_id=$1',
      [id],
    );
    expect(rows[0]?.distintas).toBe(10);
  });

  it('CP-44: rechaza cantidad fuera de la estructura, alcances simultáneos y prueba fuera del perfil', async () => {
    const { token } = await sesion();
    for (const cantidad of [3, 25]) {
      const rechazo = await inicio(token, { pruebaId, cantidad });
      expect(rechazo.status).toBe(400);
      expect(rechazo.body.error.detalles[0]).toMatchObject({
        ruta: 'cantidad',
        motivo: 'cantidad_fuera_de_rango',
      });
    }
    const dos = await inicio(token, { pruebaId, cantidad: 5, ejeId: 1, habilidadId: 1 });
    expect(dos.status).toBe(400);
    expect(dos.body.error.detalles[0].motivo).toBe('alcances_incompatibles');
    const ajena = await inicio(token, { pruebaId: lectoraId, cantidad: 5 });
    expect(ajena.status).toBe(400);
    expect(ajena.body.error.detalles[0].motivo).toBe('prueba_no_elegida');
  });

  it('CP-44: propone mezcla y ampliar alcance sin cerrar la práctica que estaba abierta', async () => {
    const { id: contenidoId } = await contenido(pruebaId);
    const { rows: otros } = await entorno.bd.query<{ id: number }>(
      'SELECT id FROM contenido.contenido_tematico WHERE prueba_id=$1 AND id<>$2 ORDER BY id LIMIT 1',
      [pruebaId, contenidoId],
    );
    const otroId = otros[0]?.id ?? 0;
    await publicar(2, { prueba: 'M1', dificultad: 'dificil', contenidoId });
    await publicar(3, { prueba: 'M1', dificultad: 'media', contenidoId });
    await publicar(3, { prueba: 'M1', dificultad: 'dificil', contenidoId: otroId });
    const { token } = await sesion();
    const anterior = await inicio(token, { pruebaId, cantidad: 5 });
    expect(anterior.status).toBe(201);
    const rechazo = await inicio(token, {
      pruebaId,
      contenidoId,
      dificultadId: dificilId,
      cantidad: 5,
    });
    expect(rechazo.status).toBe(409);
    expect(rechazo.body.error).toMatchObject({
      codigo: 'SIN_PREGUNTAS_SUFICIENTES',
      detalles: { disponibles: 2, solicitadas: 5, opciones: ['usar_mezcla', 'ampliar_alcance'] },
    });
    const { rows } = await entorno.bd.query<{ total: number; abierta: number }>(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE cerrada_en IS NULL)::int AS abierta
       FROM app.evaluacion WHERE estudiante_id=(SELECT estudiante_id FROM app.evaluacion WHERE id=$1)`,
      [anterior.body.data.id],
    );
    expect(rows[0]).toEqual({ total: 1, abierta: 1 });
  });

  it('rechaza un contenido de un curso futuro y un perfil sin año de egreso', async () => {
    const { token } = await sesion('curso@ejemplo.cl', [pruebaId], 2028);
    const futuro = await contenido(pruebaId);
    const { rows: original } = await entorno.bd.query<{ nivelEscolarId: number | null }>(
      'SELECT nivel_escolar_id AS "nivelEscolarId" FROM contenido.contenido_tematico WHERE id=$1',
      [futuro.id],
    );
    await entorno.bd.query(
      `UPDATE contenido.contenido_tematico SET nivel_escolar_id=
       (SELECT id FROM contenido.nivel_escolar WHERE codigo='4M') WHERE id=$1`,
      [futuro.id],
    );
    try {
      const rechazo = await inicio(token, { pruebaId, contenidoId: futuro.id, cantidad: 5 });
      expect(rechazo.status).toBe(400);
      expect(rechazo.body.error.detalles[0].motivo).toBe('alcance_no_disponible');
    } finally {
      await entorno.bd.query(
        'UPDATE contenido.contenido_tematico SET nivel_escolar_id=$2 WHERE id=$1',
        [futuro.id, original[0]?.nivelEscolarId ?? null],
      );
    }
    const { token: incompleto } = await sesion('incompleto@ejemplo.cl', [pruebaId], null);
    const perfil = await inicio(incompleto, { pruebaId, cantidad: 5 });
    expect(perfil.status).toBe(400);
    expect(perfil.body.error.detalles[0].motivo).toBe('perfil_incompleto');
  });

  it('usa los límites vigentes de la estructura y valida identificadores de alcance y dificultad', async () => {
    const { token } = await sesion();
    const { rows } = await entorno.bd.query<{ id: number }>(
      `SELECT s.id FROM contenido.estructura_evaluacion s
       JOIN contenido.tipo_evaluacion t ON t.id=s.tipo_evaluacion_id
       WHERE s.prueba_id=$1 AND t.codigo='practica'`,
      [pruebaId],
    );
    const estructuraId = rows[0]?.id ?? 0;
    await entorno.bd.query(
      'UPDATE contenido.estructura_evaluacion SET cantidad_min=6, cantidad_max=8 WHERE id=$1',
      [estructuraId],
    );
    try {
      const cantidad = await inicio(token, { pruebaId, cantidad: 5 });
      expect(cantidad.status).toBe(400);
      expect(cantidad.body.error.detalles[0].mensaje).toMatch(/6 y 8/);
      const eje = await inicio(token, { pruebaId, cantidad: 6, ejeId: 9999 });
      expect(eje.body.error.detalles[0].motivo).toBe('alcance_no_disponible');
      const dificultad = await inicio(token, { pruebaId, cantidad: 6, dificultadId: 9999 });
      expect(dificultad.body.error.detalles[0].motivo).toBe('dificultad_inexistente');
      expect((await inicio(token, { pruebaId, cantidad: 6, ejeId: 99999 })).status).toBe(400);
    } finally {
      await entorno.bd.query(
        'UPDATE contenido.estructura_evaluacion SET cantidad_min=5, cantidad_max=20 WHERE id=$1',
        [estructuraId],
      );
    }
  });
});
