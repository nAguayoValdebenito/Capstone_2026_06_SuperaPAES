// HU-38.1 (RF-A10, RN-14, HU-38 esc. 1 a 4): progreso por prueba, eje y habilidad contra PostgreSQL
// real. Las respuestas se guardan como lo hace base.responder (la base las corrige), con la letra y la
// hora que pide cada caso; lo esperado se calcula aquí con los pesos de contenido.dificultad.
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { crearProgresoRepositorio } from '../modulos/evaluaciones/evaluaciones.progreso.repositorio.js';
import {
  crearProgresoServicio,
  type ProgresoServicio,
} from '../modulos/evaluaciones/evaluaciones.progreso.servicio.js';
import { exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';
import { crearPreguntaPublicada, crearTextoDePrueba } from './preguntas-de-prueba.js';
import { prepararRespuestas } from './respuestas-de-prueba.js';

const RUTA_PROGRESO = '/api/v1/app/evaluaciones/progreso';

exigirBaseEnCi();
describe.skipIf(!urlBase)('progreso del estudiante con PostgreSQL (HU-38.1)', () => {
  const r = prepararRespuestas('progreso');
  const { base, entorno } = r;
  let progreso: ProgresoServicio;
  const pesos = new Map<string, number>();

  beforeAll(async () => {
    progreso = crearProgresoServicio({
      repositorio: crearProgresoRepositorio(entorno.bd),
      // Los umbrales salen de contenido.configuracion, como en la API.
      administracion: {
        obtenerParametroEntero: async (clave) => {
          const { rows } = await entorno.bd.query<{ valor: string }>(
            "SELECT valor #>> '{}' AS valor FROM contenido.configuracion WHERE clave = $1",
            [clave],
          );
          return Number(rows[0]?.valor);
        },
      },
    });
    const { rows } = await entorno.bd.query<{ codigo: string; peso: string }>(
      'SELECT codigo, peso FROM contenido.dificultad',
    );
    for (const { codigo, peso } of rows) pesos.set(codigo, Number(peso));
  });

  /** Acierto ponderado esperado: [correctas, respondidas, dificultad] de cada grupo. */
  function ponderado(grupos: [number, number, string][]): number {
    const peso = (codigo: string) => pesos.get(codigo) ?? 0;
    const arriba = grupos.reduce((suma, [c, , d]) => suma + c * peso(d), 0);
    const abajo = grupos.reduce((suma, [, n, d]) => suma + n * peso(d), 0);
    return Math.round((1000 * arriba) / abajo) / 10;
  }

  /**
   * Inicia una práctica y responde una pregunta por letra (A: correcta), a la hora indicada o ahora.
   * Las que no tienen letra quedan sin responder y no cuentan (RN-22).
   */
  async function practicar(
    token: string,
    datos: Record<string, unknown>,
    letras: string[],
    horas: Date[] = [],
  ) {
    const creada = await base.inicio(token, { cantidad: 5, ...datos });
    expect(creada.status).toBe(201);
    const id = String(creada.body.data.id as number);
    for (const [i, letra] of letras.entries()) {
      const itemId = await r.entregar(token, id);
      await entorno.bd.query(
        `UPDATE app.evaluacion_item i SET alternativa_id = a.id, respondida_en = $3,
                tipo_consumo_id = t.id
           FROM contenido.alternativa a, contenido.tipo_consumo t
          WHERE i.id = $1 AND a.pregunta_id = i.pregunta_id AND a.letra = $2 AND t.codigo = 'cupo'`,
        [itemId, letra, horas[i] ?? new Date()],
      );
    }
  }

  it('sin respuestas no hay pruebas en el progreso', async () => {
    const { id } = await base.sesion();

    expect(await progreso.obtenerProgreso(id)).toEqual({ pruebas: [] });
  });

  it(
    'suma por prueba y eje, separa por dificultad y pondera las difíciles (esc. 1 y 2)',
    async () => {
      await base.publicar(5, { prueba: 'M1', dificultad: 'media' });
      await base.publicar(5, { prueba: 'M1', dificultad: 'dificil' });
      const { id, token } = await base.sesion();

      await practicar(token, { pruebaId: base.pruebaId, dificultadId: base.mediaId }, [
        'A',
        'A',
        'A',
        'A',
        'B',
      ]);
      await practicar(token, { pruebaId: base.pruebaId, dificultadId: base.dificilId }, [
        'A',
        'B',
        'B',
        'B',
        'B',
      ]);
      const [m1] = (await progreso.obtenerProgreso(id)).pruebas;

      const esperado = ponderado([
        [4, 5, 'media'],
        [1, 5, 'dificil'],
      ]);
      expect(m1).toMatchObject({
        codigo: 'M1',
        respondidas: 10,
        correctas: 5,
        acierto: 50,
        aciertoPonderado: esperado,
        aciertoPorDificultad: { media: 80, dificil: 20 },
      });
      // Las difíciles pesan más: 45,7 % ponderado contra 50 % simple, bajo el 60 % de la configuración.
      expect(esperado).toBeLessThan(50);
      expect(m1?.ejes).toHaveLength(1);
      expect(m1?.ejes[0]).toMatchObject({ respondidas: 10, aReforzar: true });
      // Fuera de Lectora se refuerza por eje, no por habilidad.
      expect(m1?.habilidades[0]?.aReforzar).toBe(false);
      expect(m1?.semanas).toHaveLength(1);
      expect(m1?.ensayos).toEqual([]);
    },
    MINUTO,
  );

  it('con menos de 5 respuestas o sobre el 60 % el eje no se refuerza', async () => {
    await base.publicar(10, { prueba: 'M1', dificultad: 'media' });
    const pocas = await base.sesion('pocas@ejemplo.cl');
    const bien = await base.sesion('bien@ejemplo.cl');

    await practicar(pocas.token, { pruebaId: base.pruebaId }, ['B', 'B', 'B', 'B']);
    await practicar(bien.token, { pruebaId: base.pruebaId }, ['A', 'A', 'A', 'A', 'B']);

    const [conPocas] = (await progreso.obtenerProgreso(pocas.id)).pruebas;
    const [conBien] = (await progreso.obtenerProgreso(bien.id)).pruebas;
    expect(conPocas?.ejes[0]).toMatchObject({ respondidas: 4, correctas: 0, aReforzar: false });
    expect(conBien?.ejes[0]).toMatchObject({ aciertoPonderado: 80, aReforzar: false });
  });

  it(
    'un eje que todavía no se enseña en su curso no se marca (esc. 2)',
    async () => {
      // Números de M2 empieza en 2° medio: en 1° medio no se enseña.
      const { rows } = await entorno.bd.query<{ id: number; pruebaId: number }>(
        `SELECT ct.id, ct.prueba_id AS "pruebaId" FROM contenido.contenido_tematico ct
           JOIN contenido.prueba p ON p.id = ct.prueba_id
           JOIN contenido.eje_tematico e ON e.id = ct.eje_id
           JOIN contenido.nivel_escolar n ON n.id = ct.nivel_escolar_id
          WHERE p.codigo = 'M2' AND e.nombre = 'Números' ORDER BY n.orden, ct.id LIMIT 1`,
      );
      const contenido = rows[0];
      if (!contenido) throw new Error('Falta el eje Números de M2 en la semilla.');
      await base.publicar(5, { prueba: 'M2', dificultad: 'media', contenidoId: contenido.id });
      const { id, token } = await base.sesion('m2@ejemplo.cl', [contenido.pruebaId]);
      await practicar(token, { pruebaId: contenido.pruebaId }, ['B', 'B', 'B', 'B', 'B']);
      const marcado = async () =>
        (await progreso.obtenerProgreso(id)).pruebas[0]?.ejes[0]?.aReforzar;

      expect(await marcado()).toBe(true);
      await entorno.bd.query(
        'UPDATE app.estudiante SET anio_egreso = app.anio_escolar(app.hoy_chile()) + 3 WHERE id = $1',
        [id],
      );
      expect(await marcado()).toBe(false);
    },
    MINUTO,
  );

  it(
    'en Competencia Lectora se refuerza por habilidad, no por eje (RN-14)',
    async () => {
      const { rows } = await entorno.bd.query<{ id: number }>(
        `SELECT id FROM contenido.habilidad WHERE prueba_id = $1 AND nombre ILIKE '%Interpretar%'
          ORDER BY id LIMIT 1`,
        [base.lectoraId],
      );
      const habilidadId = rows[0]?.id ?? 0;
      const textoId = await crearTextoDePrueba(entorno.bd);
      for (let orden = 1; orden <= 5; orden++) {
        await crearPreguntaPublicada(entorno.bd, {
          prueba: 'CL',
          dificultad: 'media',
          habilidadId,
          textoId,
          ordenEnTexto: orden,
        });
      }
      const { id, token } = await base.sesion('lectora@ejemplo.cl', [base.lectoraId]);
      await practicar(token, { pruebaId: base.lectoraId, habilidadId }, ['B', 'B', 'B', 'A', 'B']);

      const [cl] = (await progreso.obtenerProgreso(id)).pruebas;
      expect(cl?.codigo).toBe('CL');
      expect(cl?.habilidades).toEqual([
        expect.objectContaining({ id: habilidadId, respondidas: 5, aReforzar: true }),
      ]);
      expect(cl?.ejes.every((eje) => !eje.aReforzar)).toBe(true);
    },
    MINUTO,
  );

  it('GET /evaluaciones/progreso entrega el progreso del estudiante de la sesión (HU-38.2)', async () => {
    await base.publicar(5, { prueba: 'M1', dificultad: 'media' });
    const { token } = await base.sesion();
    await practicar(token, { pruebaId: base.pruebaId }, ['A', 'A', 'B']);

    const respuesta = await request(entorno.app)
      .get(RUTA_PROGRESO)
      .set('Authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.pruebas).toEqual([
      expect.objectContaining({
        pruebaId: base.pruebaId,
        codigo: 'M1',
        respondidas: 3,
        correctas: 2,
        aciertoPorDificultad: { media: 66.7 },
      }),
    ]);
    expect(typeof respuesta.body.data.pruebas[0].ejes[0].id).toBe('number');
  });

  it('sin la sesión de la app la ruta responde 401', async () => {
    expect((await request(entorno.app).get(RUTA_PROGRESO)).status).toBe(401);
  });

  it('la semana empieza el lunes en hora de Chile (esc. 3)', async () => {
    await base.publicar(5, { prueba: 'M1', dificultad: 'media' });
    const { id, token } = await base.sesion();

    // 25/10 a las 23:30 de Chile es domingo (semana del 19); 26/10 a las 00:30, lunes. En UTC los dos
    // son lunes 26.
    await practicar(
      token,
      { pruebaId: base.pruebaId },
      ['A', 'B', 'A'],
      [
        new Date('2026-10-26T02:30:00Z'),
        new Date('2026-10-26T03:30:00Z'),
        new Date('2026-10-27T15:00:00Z'),
      ],
    );

    const [m1] = (await progreso.obtenerProgreso(id)).pruebas;
    expect(m1?.semanas).toEqual([
      { semana: '2026-10-19', respondidas: 1, acierto: 100 },
      { semana: '2026-10-26', respondidas: 2, acierto: 50 },
    ]);
  });
});
