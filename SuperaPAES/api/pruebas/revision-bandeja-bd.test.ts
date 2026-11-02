// Bandeja del docente revisor contra PostgreSQL real (HU-22, CU-19, RF-G07, CP-16 paso 3; ver
// base-temporal.ts): con el temario de las semillas, una pregunta de Historia con dificultad sugerida se
// envía a revisión (HU-21). Cada docente ve solo sus revisiones; al abrirla recibe la versión enviada, sin
// la dificultad sugerida ni la revisión del otro; al entregarla quedan la revisión, cada punto de la pauta
// y la asignación completada, y la pregunta sigue en revisión (combinar las dos es de HU-23).
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearServicios, type Servicios } from '../app.js';
import { ejecutarEnTransaccion } from '../db/transaccion.js';
import { ejecutarSemillas } from '../db/semillas.js';
import { esquemaPregunta } from '../modulos/preguntas/preguntas.validadores.js';
import { esquemaRevision } from '../modulos/revision/revision.validadores.js';
import { crearDependenciasDePrueba } from './ayudantes.js';
import { uno } from './banco-de-prueba.js';
import {
  type BaseTemporal,
  crearBaseTemporal,
  exigirBaseEnCi,
  MINUTO,
  urlBase,
} from './base-temporal.js';
import { alternativas } from './edicion-de-prueba.js';

describe('bandeja del docente sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('bandeja del docente con PostgreSQL (HU-22, CP-16)', () => {
  let base: BaseTemporal;
  let servicios: Servicios;
  let pauta: string[] = [];
  const ids = new Map<string, string>();
  let preguntaId = '';

  const id = (clave: string) => ids.get(clave) ?? '';

  async function cuenta(correo: string, rol: string, areas: string[] = []) {
    const usuario = String(
      await uno(
        base.bd,
        `INSERT INTO contenido.usuario_interno (nombre, correo, hash_contrasena, rol_id, creado_en)
         SELECT $1, $1, 'x', id, now() FROM contenido.rol WHERE codigo = $2 RETURNING id`,
        [correo, rol],
      ),
    );
    await base.bd.query(
      `INSERT INTO contenido.docente_especialidad (usuario_interno_id, area_id)
       SELECT $1, id FROM contenido.area WHERE nombre = ANY ($2::text[])`,
      [usuario, areas],
    );
    ids.set(correo, usuario);
  }

  /** La asignación del docente para la pregunta. */
  const asignacionDe = async (correo: string) =>
    String(
      await uno(
        base.bd,
        'SELECT id FROM contenido.asignacion_revision WHERE pregunta_id = $1 AND docente_id = $2',
        [preguntaId, id(correo)],
      ),
    );

  /** Una revisión completa: cumple toda la pauta salvo lo indicado. */
  const revision = (cambios: Record<string, unknown> = {}) =>
    esquemaRevision.parse({
      criterios: pauta.map((codigo) => ({ codigo, cumple: true })),
      dificultad: 'media',
      decision: 'aprobar',
      ...cambios,
    });

  beforeAll(async () => {
    base = await crearBaseTemporal('bandeja');
    await ejecutarSemillas(base.bd, path.join(import.meta.dirname, '../db/semillas'));
    servicios = crearServicios(
      crearDependenciasDePrueba({
        bd: base.bd,
        unidadDeTrabajo: { enTransaccion: (trabajo) => ejecutarEnTransaccion(base.bd, trabajo) },
      }),
    );
    await cuenta('admin@bandeja.cl', 'admin');
    await cuenta('h1@bandeja.cl', 'docente', ['Historia']);
    await cuenta('h2@bandeja.cl', 'docente', ['Historia']);
    await cuenta('h3@bandeja.cl', 'docente', ['Historia']);
    pauta = (
      await base.bd.query<{ codigo: string }>(
        'SELECT codigo FROM contenido.criterio_pauta WHERE activo ORDER BY orden',
      )
    ).rows.map((fila) => fila.codigo);
    const { rows } = await base.bd.query<{ prueba: number; contenido: number; habilidad: number }>(
      `SELECT c.prueba_id AS prueba, c.id AS contenido,
              (SELECT min(h.id) FROM contenido.habilidad h WHERE h.prueba_id = c.prueba_id) AS habilidad
         FROM contenido.contenido_tematico c JOIN contenido.area a ON a.id = c.area_id
         JOIN contenido.prueba p ON p.id = c.prueba_id
        WHERE a.nombre = 'Historia' AND p.textos IS NULL ORDER BY c.id LIMIT 1`,
    );
    const fila = rows[0];
    if (!fila) throw new Error('Sin contenidos de Historia.');
    const creada = await servicios.preguntas.crearPregunta(
      id('admin@bandeja.cl'),
      esquemaPregunta.parse({
        pruebaId: fila.prueba,
        contenidoId: fila.contenido,
        habilidadId: fila.habilidad,
        tipoPregunta: 'seleccion_multiple',
        dificultadSugerida: 'dificil',
        enunciado: '¿En qué año se firmó la Independencia de Chile?',
        explicacion: 'El acta se firmó en 1818.',
        alternativas: alternativas(4, ['C']),
      }),
    );
    preguntaId = creada.id;
    // h1 y h2 tienen menos carga (y menor id) que h3: son los revisores.
    await servicios.revision.enviarARevision(id('admin@bandeja.cl'), preguntaId);
  }, MINUTO);

  afterAll(() => base.cerrar(), MINUTO);

  it('cada docente ve solo sus revisiones pendientes, con su fecha límite', async () => {
    const deH1 = await servicios.revision.listarMisRevisiones(id('h1@bandeja.cl'));
    const deH3 = await servicios.revision.listarMisRevisiones(id('h3@bandeja.cl'));

    expect(deH1).toEqual([
      expect.objectContaining({
        preguntaId,
        ronda: 1,
        prueba: expect.objectContaining({ codigo: 'HCS' }),
      }),
    ]);
    expect(deH3).toEqual([]);
  });

  it('CP-16 paso 3: al abrirla no recibe la dificultad sugerida ni la revisión del otro docente', async () => {
    const motivoDeH2 = 'Motivo que solo conoce h2';
    await servicios.revision.entregarRevision(
      id('h2@bandeja.cl'),
      await asignacionDe('h2@bandeja.cl'),
      revision({ decision: 'rechazar', dificultad: 'facil', comentario: motivoDeH2 }),
    );

    const abierta = await servicios.revision.obtenerMiRevision(
      id('h1@bandeja.cl'),
      await asignacionDe('h1@bandeja.cl'),
    );

    expect(abierta).toMatchObject({
      preguntaId,
      enunciado: '¿En qué año se firmó la Independencia de Chile?',
      explicacion: 'El acta se firmó en 1818.',
    });
    expect(abierta.alternativas.filter((a) => a.esCorrecta).map((a) => a.letra)).toEqual(['C']);
    expect(abierta.pauta.map((criterio) => criterio.codigo)).toEqual(pauta);
    const json = JSON.stringify(abierta);
    expect(json).not.toContain(motivoDeH2);
    expect(json).not.toMatch(/sugerida/i);
    expect(Object.keys(abierta)).not.toContain('dificultad');
  });

  it('al entregarla guarda la revisión, cada punto de la pauta y completa la asignación; la pregunta sigue en revisión', async () => {
    const asignacion = await asignacionDe('h1@bandeja.cl');
    const criterios = pauta.map((codigo, i) =>
      i === 0
        ? { codigo, cumple: false, observacion: 'No evalúa el contenido.' }
        : { codigo, cumple: true },
    );

    const entregada = await servicios.revision.entregarRevision(
      id('h1@bandeja.cl'),
      asignacion,
      revision({ criterios, decision: 'observar', comentario: 'Cambiar el contenido.' }),
    );

    expect(entregada).toEqual({
      asignacionId: asignacion,
      preguntaId,
      decision: 'observar',
      dificultad: 'media',
    });
    const { rows: guardada } = await base.bd.query(
      `SELECT d.codigo AS decision, f.codigo AS dificultad, r.comentario,
              (SELECT count(*)::int FROM contenido.revision_criterio rc WHERE rc.revision_id = r.id) AS puntos,
              (SELECT count(*)::int FROM contenido.revision_criterio rc WHERE rc.revision_id = r.id AND NOT rc.cumple) AS "noCumple",
              e.codigo AS asignacion, a.completado_en IS NOT NULL AS completada
         FROM contenido.revision r
         JOIN contenido.asignacion_revision a ON a.id = r.asignacion_id
         JOIN contenido.estado_asignacion e ON e.id = a.estado_asignacion_id
         JOIN contenido.decision_revision d ON d.id = r.decision_revision_id
         JOIN contenido.dificultad f ON f.id = r.dificultad_id
        WHERE r.asignacion_id = $1`,
      [asignacion],
    );
    expect(guardada).toEqual([
      {
        decision: 'observar',
        dificultad: 'media',
        comentario: 'Cambiar el contenido.',
        puntos: pauta.length,
        noCumple: 1,
        asignacion: 'completada',
        completada: true,
      },
    ]);
    const { rows: estado } = await base.bd.query<{ codigo: string }>(
      `SELECT e.codigo FROM contenido.pregunta p
         JOIN contenido.estado_pregunta e ON e.id = p.estado_pregunta_id WHERE p.id = $1`,
      [preguntaId],
    );
    expect(estado).toEqual([{ codigo: 'en_revision' }]);
    expect(await servicios.revision.listarMisRevisiones(id('h1@bandeja.cl'))).toEqual([]);
  });

  it('no se entrega dos veces ni se entrega la revisión de otro docente', async () => {
    const deH1 = await asignacionDe('h1@bandeja.cl');

    await expect(
      servicios.revision.entregarRevision(id('h1@bandeja.cl'), deH1, revision()),
    ).rejects.toThrow('Esta revisión ya se entregó.');
    await expect(servicios.revision.obtenerMiRevision(id('h3@bandeja.cl'), deH1)).rejects.toThrow(
      'La revisión no existe o ya la entregaste.',
    );
    await expect(
      servicios.revision.entregarRevision(id('h3@bandeja.cl'), deH1, revision()),
    ).rejects.toThrow('La revisión no existe o ya la entregaste.');
  });
});
