// Resolver la ronda de revisión contra PostgreSQL real (HU-23, CU-19 paso 7, RN-10 a RN-12, CP-16; ver
// base-temporal.ts): con el temario de las semillas y tres docentes de Historia, cada pregunta se envía a
// revisión (HU-21) y sus dos revisores entregan (HU-22). Si coinciden, la pregunta queda aprobada con su
// dificultad y el historial a nombre de quien entregó la última; si no, queda en desempate, marcada como
// posiblemente confusa si una dijo fácil y la otra difícil, y con el tercer docente asignado, que ve las
// dos revisiones sin sus autores y decide (D02, CU-20); sin un tercer docente disponible, sigue en
// revisión.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Servicios } from '../app.js';
import { esquemaPregunta } from '../modulos/preguntas/preguntas.validadores.js';
import { esquemaRevision } from '../modulos/revision/revision.validadores.js';
import { type BaseTemporal, exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';
import { alternativas } from './edicion-de-prueba.js';
import {
  crearCuenta,
  pautaActiva,
  prepararBaseDeRevision,
  temarioDeHistoria,
} from './revision-bd.js';

describe('resolver la ronda sin base de datos', () => {
  exigirBaseEnCi();
});

interface EstadoDeLaPregunta {
  estado: string;
  dificultad: string | null;
  posibleAmbigua: boolean;
  ultimoCambioPor: string | null;
}

describe.skipIf(!urlBase)('resolver la ronda con PostgreSQL (HU-23, CP-16)', () => {
  let base: BaseTemporal;
  let servicios: Servicios;
  let pauta: string[] = [];
  let temario = { prueba: 0, contenido: 0, habilidad: 0 };
  const ids = new Map<string, string>();

  const id = (correo: string) => ids.get(correo) ?? '';

  const cuenta = async (correo: string, rol: string, areas: string[] = []) => {
    ids.set(correo, await crearCuenta(base.bd, [correo, rol], areas));
  };

  /** Crea una pregunta de Historia a nombre de `autor` y la envía a revisión. */
  async function enRevision(autor: string, enunciado: string): Promise<string> {
    const creada = await servicios.preguntas.crearPregunta(
      id(autor),
      esquemaPregunta.parse({
        pruebaId: temario.prueba,
        contenidoId: temario.contenido,
        habilidadId: temario.habilidad,
        tipoPregunta: 'seleccion_multiple',
        dificultadSugerida: 'media',
        enunciado,
        explicacion: 'Explicación.',
        alternativas: alternativas(4, ['B']),
      }),
    );
    await servicios.revision.enviarARevision(id('admin@ronda.cl'), creada.id);
    return creada.id;
  }

  /** Las asignaciones de la pregunta por docente, con su papel y estado. */
  async function asignaciones(preguntaId: string) {
    const { rows } = await base.bd.query<{
      id: string;
      docente: string;
      rol: string;
      estado: string;
    }>(
      `SELECT a.id::text AS id, a.docente_id::text AS docente, r.codigo AS rol, e.codigo AS estado
         FROM contenido.asignacion_revision a
         JOIN contenido.rol_revision r ON r.id = a.rol_revision_id
         JOIN contenido.estado_asignacion e ON e.id = a.estado_asignacion_id
        WHERE a.pregunta_id = $1 ORDER BY a.id`,
      [preguntaId],
    );
    return rows;
  }

  /** Cada revisor entrega su revisión, en orden, con la decisión y la dificultad indicadas. */
  async function entregar(preguntaId: string, revisiones: [string, string][]) {
    const revisores = (await asignaciones(preguntaId)).filter((a) => a.rol === 'revisor');
    for (const [i, [decision, dificultad]] of revisiones.entries()) {
      const asignacion = revisores[i];
      if (!asignacion) throw new Error('Falta un revisor.');
      await servicios.revision.entregarRevision(
        asignacion.docente,
        asignacion.id,
        esquemaRevision.parse({
          criterios: pauta.map((codigo) => ({ codigo, cumple: true })),
          dificultad,
          decision,
          comentario: decision === 'aprobar' ? null : 'Motivo.',
        }),
      );
    }
    return revisores.map((asignacion) => asignacion.docente);
  }

  const estadoDe = async (preguntaId: string) =>
    (
      await base.bd.query<EstadoDeLaPregunta>(
        `SELECT e.codigo AS estado, d.codigo AS dificultad, p.posible_ambigua AS "posibleAmbigua",
                (SELECT h.usuario_id::text FROM contenido.historial_estado_pregunta h
                  WHERE h.pregunta_id = p.id ORDER BY h.id DESC LIMIT 1) AS "ultimoCambioPor"
           FROM contenido.pregunta p
           JOIN contenido.estado_pregunta e ON e.id = p.estado_pregunta_id
           LEFT JOIN contenido.dificultad d ON d.id = p.dificultad_asignada_id
          WHERE p.id = $1`,
        [preguntaId],
      )
    ).rows[0];

  beforeAll(async () => {
    ({ base, servicios } = await prepararBaseDeRevision('ronda'));
    await cuenta('admin@ronda.cl', 'admin');
    for (const correo of ['h1@ronda.cl', 'h2@ronda.cl', 'h3@ronda.cl']) {
      await cuenta(correo, 'docente', ['Historia']);
    }
    pauta = await pautaActiva(base.bd);
    temario = await temarioDeHistoria(base.bd);
  }, MINUTO);

  afterAll(() => base.cerrar(), MINUTO);

  it('CP-16: dos aprobaciones con la misma dificultad dejan la pregunta aprobada con esa dificultad', async () => {
    const preguntaId = await enRevision('admin@ronda.cl', '¿Coinciden los dos revisores?');

    const revisores = await entregar(preguntaId, [
      ['aprobar', 'media'],
      ['aprobar', 'media'],
    ]);

    expect(await estadoDe(preguntaId)).toEqual({
      estado: 'aprobada',
      dificultad: 'media',
      posibleAmbigua: false,
      ultimoCambioPor: revisores[1],
    });
  });

  it('CP-16: fácil contra difícil queda en desempate, posiblemente confusa y con el tercer docente', async () => {
    const preguntaId = await enRevision('admin@ronda.cl', '¿Fácil o difícil?');

    const revisores = await entregar(preguntaId, [
      ['aprobar', 'facil'],
      ['aprobar', 'dificil'],
    ]);

    expect(await estadoDe(preguntaId)).toMatchObject({
      estado: 'en_desempate',
      dificultad: null,
      posibleAmbigua: true,
    });
    const tercero = (await asignaciones(preguntaId)).filter((a) => a.rol === 'desempate');
    expect(tercero).toEqual([expect.objectContaining({ estado: 'pendiente' })]);
    expect(revisores).not.toContain(tercero[0]?.docente);
    const { rows: plazo } = await base.bd.query<{ dias: number }>(
      `SELECT extract(day FROM vence_en - asignado_en)::int AS dias
         FROM contenido.asignacion_revision WHERE id = $1`,
      [tercero[0]?.id],
    );
    expect(plazo).toEqual([{ dias: 3 }]);
  });

  it('D02: el tercer docente ve las dos revisiones sin sus autores y su decisión deja la pregunta aprobada', async () => {
    const preguntaId = await enRevision('admin@ronda.cl', '¿Quién desempata?');
    const revisores = await entregar(preguntaId, [
      ['aprobar', 'facil'],
      ['rechazar', 'dificil'],
    ]);
    const tercero = (await asignaciones(preguntaId)).find((a) => a.rol === 'desempate');
    if (!tercero) throw new Error('Sin tercer docente.');
    const revisor = revisores[0] ?? '';

    const bandeja = await servicios.revision.listarDesempates(tercero.docente);
    const abierto = await servicios.revision.obtenerDesempate(tercero.docente, tercero.id);

    expect(bandeja.map((desempate) => desempate.id)).toContain(tercero.id);
    expect(await servicios.revision.listarDesempates(revisor)).toEqual([]);
    expect(abierto.revisiones.map((r) => [r.decision.codigo, r.dificultad.codigo])).toEqual([
      ['aprobar', 'facil'],
      ['rechazar', 'dificil'],
    ]);
    expect(abierto.revisiones[1]?.criterios).toHaveLength(pauta.length);
    expect(abierto.posibleAmbigua).toBe(true);
    expect(JSON.stringify(abierto)).not.toMatch(/@ronda\.cl/);
    await expect(servicios.revision.obtenerDesempate(revisor, tercero.id)).rejects.toThrow(
      'El desempate no existe o ya lo entregaste.',
    );

    const decidido = await servicios.revision.entregarDesempate(tercero.docente, tercero.id, {
      dificultad: 'dificil',
      decision: 'aprobar',
      comentario: null,
    });

    expect(decidido).toMatchObject({ estado: 'aprobada', dificultad: 'dificil' });
    expect(await estadoDe(preguntaId)).toEqual({
      estado: 'aprobada',
      dificultad: 'dificil',
      posibleAmbigua: true,
      ultimoCambioPor: tercero.docente,
    });
    await expect(
      servicios.revision.entregarDesempate(tercero.docente, tercero.id, {
        dificultad: 'media',
        decision: 'aprobar',
        comentario: null,
      }),
    ).rejects.toThrow('Este desempate ya se entregó.');
  });

  it('sin un tercer docente disponible, la pregunta sigue en revisión con las dos revisiones', async () => {
    // h3 es el autor (RN-10): solo h1 y h2 pueden revisarla y no queda nadie para el desempate.
    const preguntaId = await enRevision('h3@ronda.cl', '¿Sin tercer docente?');

    await entregar(preguntaId, [
      ['aprobar', 'media'],
      ['rechazar', 'media'],
    ]);

    expect(await estadoDe(preguntaId)).toMatchObject({
      estado: 'en_revision',
      posibleAmbigua: false,
    });
    const ronda = await asignaciones(preguntaId);
    expect(ronda.map((a) => [a.rol, a.estado])).toEqual([
      ['revisor', 'completada'],
      ['revisor', 'completada'],
    ]);
  });
});
