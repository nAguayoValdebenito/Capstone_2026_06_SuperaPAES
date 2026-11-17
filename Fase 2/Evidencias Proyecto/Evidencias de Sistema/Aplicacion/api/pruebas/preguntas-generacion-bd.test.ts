// HU-16.2 y HU-17.2: lo que el generador lee del banco. Los enunciados del contenido en cualquier estado
// (rechazadas y retiradas también cuentan como duplicado) y los ejemplos que se le dan a la IA: solo
// preguntas aprobadas o publicadas, de origen manual o IA, nunca importadas (RN-29).
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearServicios } from '../app.js';
import { ejecutarSemillas } from '../db/semillas.js';
import { crearDependenciasDePrueba } from './ayudantes.js';
import { crearBaseTemporal, exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';

describe('lecturas del banco para generar sin base', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('lecturas del banco para generar con PostgreSQL', () => {
  let base: Awaited<ReturnType<typeof crearBaseTemporal>>;
  let preguntas: ReturnType<typeof crearServicios>['preguntas'];
  let contenidoA = 0;
  let contenidoB = 0;
  let habilidadId = 0;
  let pruebaId = 0;

  beforeAll(async () => {
    base = await crearBaseTemporal('preguntas_generar');
    await ejecutarSemillas(base.bd, path.join(import.meta.dirname, '../db/semillas'));
    preguntas = crearServicios(crearDependenciasDePrueba({ bd: base.bd })).preguntas;
    const { rows } = await base.bd.query<{ id: number; prueba_id: number; habilidad: number }>(
      `SELECT c.id, c.prueba_id, (SELECT h.id FROM contenido.habilidad h WHERE h.prueba_id = c.prueba_id LIMIT 1) AS habilidad
         FROM contenido.contenido_tematico c JOIN contenido.prueba p ON p.id = c.prueba_id
        WHERE p.codigo = 'M1' ORDER BY c.id LIMIT 2`,
    );
    [contenidoA, contenidoB] = [rows[0]!.id, rows[1]!.id];
    pruebaId = rows[0]!.prueba_id;
    habilidadId = rows[0]!.habilidad;
  }, MINUTO);
  afterAll(async () => {
    await base.cerrar();
  }, MINUTO);
  beforeEach(async () => {
    await base.bd.query('TRUNCATE contenido.pregunta CASCADE');
  });

  /** Inserta una pregunta en el estado y con el origen indicados, sin pasar por el ciclo de vida. */
  async function insertar(
    enunciado: string,
    opciones: { contenido: number; estado: string; origen?: 'manual' | 'ia' | 'importada' },
  ): Promise<number> {
    await base.bd.query("SET session_replication_role = 'replica'");
    try {
      const { rows } = await base.bd.query<{ id: number }>(
        `INSERT INTO contenido.pregunta
           (prueba_id, contenido_id, habilidad_id, tipo_pregunta_id, enunciado, explicacion,
            lote_id, importacion_id, estado_pregunta_id, creado_en, actualizado_en)
         SELECT $1, $2, $3, t.id, $4, 'Explicación.',
                CASE WHEN $6 = 'ia' THEN 1 END, CASE WHEN $6 = 'importada' THEN 1 END, e.id, now(), now()
           FROM contenido.tipo_pregunta t, contenido.estado_pregunta e
          WHERE t.codigo = 'seleccion_multiple' AND e.codigo = $5
         RETURNING id`,
        [
          pruebaId,
          opciones.contenido,
          habilidadId,
          enunciado,
          opciones.estado,
          opciones.origen ?? 'manual',
        ],
      );
      const id = rows[0]!.id;
      for (const [letra, texto, correcta] of [
        ['A', '$3$', false],
        ['B', '$4$', true],
      ] as const) {
        await base.bd.query(
          'INSERT INTO contenido.alternativa (pregunta_id, letra, texto, es_correcta, explicacion) VALUES ($1,$2,$3,$4,$5)',
          [id, letra, texto, correcta, `Explicación de ${letra}.`],
        );
      }
      return id;
    } finally {
      await base.bd.query("SET session_replication_role = 'origin'");
    }
  }

  it('los enunciados del contenido incluyen todos los estados y no los de otro contenido', async () => {
    for (const estado of [
      'borrador',
      'en_revision',
      'aprobada',
      'rechazada',
      'publicada',
      'retirada',
    ]) {
      await insertar(`Enunciado ${estado}`, { contenido: contenidoA, estado });
    }
    await insertar('Enunciado de otro contenido', { contenido: contenidoB, estado: 'publicada' });

    const enunciados = await preguntas.enunciadosDelContenido(contenidoA);

    expect(enunciados.sort()).toEqual(
      [
        'Enunciado aprobada',
        'Enunciado borrador',
        'Enunciado en_revision',
        'Enunciado publicada',
        'Enunciado rechazada',
        'Enunciado retirada',
      ].sort(),
    );
  });

  it('los ejemplos son solo aprobadas o publicadas de origen manual o IA', async () => {
    await insertar('Manual aprobada', { contenido: contenidoA, estado: 'aprobada' });
    await insertar('IA publicada', { contenido: contenidoA, estado: 'publicada', origen: 'ia' });
    await insertar('Importada publicada', {
      contenido: contenidoA,
      estado: 'publicada',
      origen: 'importada',
    });
    await insertar('Manual borrador', { contenido: contenidoA, estado: 'borrador' });
    await insertar('Manual rechazada', { contenido: contenidoA, estado: 'rechazada' });
    await insertar('Manual retirada', { contenido: contenidoA, estado: 'retirada' });
    await insertar('Otro contenido', { contenido: contenidoB, estado: 'publicada' });

    const ejemplos = await preguntas.ejemplosAprobados(contenidoA, 10);

    expect(ejemplos.map((e) => e.enunciado).sort()).toEqual(['IA publicada', 'Manual aprobada']);
  });

  it('entrega las alternativas con la correcta marcada y respeta el límite, las más recientes primero', async () => {
    await insertar('Primera', { contenido: contenidoA, estado: 'publicada' });
    await insertar('Segunda', { contenido: contenidoA, estado: 'publicada' });
    await insertar('Tercera', { contenido: contenidoA, estado: 'publicada' });

    const ejemplos = await preguntas.ejemplosAprobados(contenidoA, 2);

    expect(ejemplos.map((e) => e.enunciado)).toEqual(['Tercera', 'Segunda']);
    expect(ejemplos[0]?.alternativas).toEqual([
      { letra: 'A', texto: '$3$', esCorrecta: false },
      { letra: 'B', texto: '$4$', esCorrecta: true },
    ]);
  });

  it('sin preguntas aprobadas devuelve una lista vacía, y un límite 0 también', async () => {
    await insertar('Manual aprobada', { contenido: contenidoA, estado: 'aprobada' });

    expect(await preguntas.ejemplosAprobados(contenidoB, 3)).toEqual([]);
    expect(await preguntas.ejemplosAprobados(contenidoA, 0)).toEqual([]);
  });
});
