// Clasificar dificultad del banco semilla contra PostgreSQL real (HU-25.1, CU-19a, RF-G12, D03; ver
// base-temporal.ts). Con el temario de las semillas, dos preguntas importadas y una creada en la consola
// se envían a revisión (CU-18 7.a): h1 y h2, los dos docentes de Historia, son sus revisores; h3
// llega después y queda para el desempate. La bandeja
// tiene solo las importadas, a ciegas y en orden; saltar da la vuelta; cada revisor recibe su propia
// asignación; un clic guarda la revisión con la pauta cumplida y la ronda sigue RN-11 y RN-12, también
// con una revisión completa de D01.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Servicios } from '../app.js';
import { esquemaRevision } from '../modulos/revision/revision.validadores.js';
import { uno } from './banco-de-prueba.js';
import { type BaseTemporal, exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';
import {
  crearCuenta,
  crearPreguntaDeHistoria,
  pautaActiva,
  prepararBaseDeRevision,
  serviciosSobre,
  temarioDeHistoria,
} from './revision-bd.js';

describe('clasificar dificultad sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('clasificar dificultad con PostgreSQL (HU-25, CU-19a)', () => {
  let base: BaseTemporal;
  let servicios: Servicios;
  let pauta: string[] = [];
  const ids = new Map<string, string>();

  const id = (clave: string) => ids.get(clave) ?? '';

  /** La asignación del docente para la pregunta. */
  const asignacion = async (docente: string, pregunta: string) =>
    String(
      await uno(
        base.bd,
        'SELECT id FROM contenido.asignacion_revision WHERE pregunta_id = $1 AND docente_id = $2',
        [id(pregunta), id(docente)],
      ),
    );

  /** El estado, la dificultad asignada y si es posiblemente confusa. */
  const pregunta = async (clave: string) => {
    const { rows } = await base.bd.query<{
      estado: string;
      dificultad: string | null;
      ambigua: boolean;
    }>(
      `SELECT e.codigo AS estado, d.codigo AS dificultad, p.posible_ambigua AS ambigua
         FROM contenido.pregunta p JOIN contenido.estado_pregunta e ON e.id = p.estado_pregunta_id
         LEFT JOIN contenido.dificultad d ON d.id = p.dificultad_asignada_id
        WHERE p.id = $1`,
      [id(clave)],
    );
    return rows[0];
  };

  /** Crea una pregunta de Historia; si es importada, la liga a una importación. */
  const crear = async (clave: string, importada: boolean) => {
    const temario = await temarioDeHistoria(base.bd);
    const creada = await crearPreguntaDeHistoria(servicios, temario, [
      id('admin'),
      `Pregunta ${clave}`,
    ]);
    ids.set(clave, creada);
    if (importada) {
      await base.bd.query('UPDATE contenido.pregunta SET importacion_id = $1 WHERE id = $2', [
        id('importacion'),
        creada,
      ]);
    }
    await servicios.revision.enviarARevision(id('admin'), creada);
  };

  beforeAll(async () => {
    ({ base, servicios } = await prepararBaseDeRevision('clasificar'));
    ids.set('admin', await crearCuenta(base.bd, ['admin@clasificar.cl', 'admin']));
    ids.set('h1', await crearCuenta(base.bd, ['h1@clasificar.cl', 'docente'], ['Historia']));
    ids.set('h2', await crearCuenta(base.bd, ['h2@clasificar.cl', 'docente'], ['Historia']));
    ids.set('m1', await crearCuenta(base.bd, ['m1@clasificar.cl', 'docente'], ['Matemática']));
    pauta = await pautaActiva(base.bd);
    const importacion = await uno(
      base.bd,
      `INSERT INTO contenido.importacion (usuario_id, nombre_archivo, filas_total, filas_creadas,
                                          filas_con_error, creado_en)
       VALUES ($1, 'banco.csv', 2, 2, 0, now()) RETURNING id`,
      [id('admin')],
    );
    ids.set('importacion', String(importacion));
    await crear('q1', true);
    await crear('q2', true);
    await crear('propia', false);
    // El tercer docente del área llega después de los envíos: decide los desempates (CU-20).
    ids.set('h3', await crearCuenta(base.bd, ['h3@clasificar.cl', 'docente'], ['Historia']));
  }, MINUTO);

  afterAll(() => base.cerrar(), MINUTO);

  it('la bandeja tiene solo las importadas del docente, la más antigua primero, sin la dificultad sugerida', async () => {
    const siguiente = await servicios.revision.siguienteAClasificar(id('h1'), null);
    const deOtraArea = await servicios.revision.siguienteAClasificar(id('m1'), null);

    expect(siguiente.quedan).toBe(2);
    expect(siguiente.pregunta).toMatchObject({
      id: await asignacion('h1', 'q1'),
      preguntaId: id('q1'),
      enunciado: 'Pregunta q1',
      dificultades: [
        { codigo: 'facil', nombre: 'Fácil' },
        { codigo: 'media', nombre: 'Media' },
        { codigo: 'dificil', nombre: 'Difícil' },
      ],
    });
    expect(JSON.stringify(siguiente)).not.toMatch(/sugerida/i);
    expect(deOtraArea).toEqual({ pregunta: null, quedan: 0 });
  });

  it('saltar pasa a la siguiente y, al final, vuelve a la primera', async () => {
    const despuesDeQ1 = await servicios.revision.siguienteAClasificar(
      id('h1'),
      await asignacion('h1', 'q1'),
    );
    const despuesDeQ2 = await servicios.revision.siguienteAClasificar(
      id('h1'),
      await asignacion('h1', 'q2'),
    );

    expect(despuesDeQ1.pregunta?.preguntaId).toBe(id('q2'));
    expect(despuesDeQ2.pregunta?.preguntaId).toBe(id('q1'));
  });

  it('dos docentes que piden la siguiente a la vez reciben cada uno su propia asignación (RN-10)', async () => {
    const [deH1, deH2] = await Promise.all([
      servicios.revision.siguienteAClasificar(id('h1'), null),
      servicios.revision.siguienteAClasificar(id('h2'), null),
    ]);

    expect(deH1.pregunta?.id).toBe(await asignacion('h1', 'q1'));
    expect(deH2.pregunta?.id).toBe(await asignacion('h2', 'q1'));
    expect(deH1.pregunta?.id).not.toBe(deH2.pregunta?.id);
  });

  it('una pregunta no importada no se clasifica en D03 (404)', async () => {
    await expect(
      servicios.revision.clasificarDificultad(id('h1'), await asignacion('h1', 'propia'), 'media'),
    ).rejects.toMatchObject({ estadoHttp: 404 });
  });

  it('un clic guarda la revisión con la pauta cumplida y completa la asignación; dos clics a la vez, uno gana', async () => {
    const deH1 = await asignacion('h1', 'q1');
    // El mismo docente desde dos pestañas: dos peticiones a la vez, por conexiones distintas.
    const otra = await base.conectarOtra();
    const resultados = await Promise.allSettled([
      servicios.revision.clasificarDificultad(id('h1'), deH1, 'media'),
      serviciosSobre(otra).revision.clasificarDificultad(id('h1'), deH1, 'media'),
    ]).finally(() => otra.end());

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(resultados.find((r) => r.status === 'rejected')).toMatchObject({
      reason: { estadoHttp: 409 },
    });
    const guardada = await base.bd.query<{ decision: string; dificultad: string; cumplen: number }>(
      `SELECT dr.codigo AS decision, d.codigo AS dificultad,
              (SELECT count(*)::int FROM contenido.revision_criterio rc
                WHERE rc.revision_id = r.id AND rc.cumple) AS cumplen
         FROM contenido.revision r
         JOIN contenido.decision_revision dr ON dr.id = r.decision_revision_id
         JOIN contenido.dificultad d ON d.id = r.dificultad_id
        WHERE r.asignacion_id = $1`,
      [deH1],
    );
    expect(guardada.rows).toEqual([
      { decision: 'aprobar', dificultad: 'media', cumplen: pauta.length },
    ]);
    expect(await pregunta('q1')).toMatchObject({ estado: 'en_revision', dificultad: null });
    expect((await servicios.revision.siguienteAClasificar(id('h1'), null)).quedan).toBe(1);
  });

  it('con la misma dificultad del otro revisor, la pregunta queda aprobada con esa dificultad (RN-11)', async () => {
    const clasificada = await servicios.revision.clasificarDificultad(
      id('h2'),
      await asignacion('h2', 'q1'),
      'media',
    );

    expect(clasificada.guardada).toEqual({
      asignacionId: await asignacion('h2', 'q1'),
      preguntaId: id('q1'),
      dificultad: 'media',
    });
    expect(clasificada.siguiente).toMatchObject({ quedan: 1, pregunta: { preguntaId: id('q2') } });
    expect(await pregunta('q1')).toEqual({
      estado: 'aprobada',
      dificultad: 'media',
      ambigua: false,
    });
  });

  it('fácil en D03 contra difícil en la revisión completa de D01 va a desempate y queda posiblemente confusa (RN-12)', async () => {
    await servicios.revision.clasificarDificultad(id('h1'), await asignacion('h1', 'q2'), 'facil');
    await servicios.revision.entregarRevision(
      id('h2'),
      await asignacion('h2', 'q2'),
      esquemaRevision.parse({
        criterios: pauta.map((codigo) => ({ codigo, cumple: true })),
        dificultad: 'dificil',
        decision: 'aprobar',
      }),
    );

    expect(await pregunta('q2')).toEqual({
      estado: 'en_desempate',
      dificultad: null,
      ambigua: true,
    });
    expect(await servicios.revision.siguienteAClasificar(id('h1'), null)).toEqual({
      pregunta: null,
      quedan: 0,
    });
  });
});
