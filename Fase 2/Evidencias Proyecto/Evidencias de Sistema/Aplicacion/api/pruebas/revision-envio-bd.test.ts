// Enviar a revisión contra PostgreSQL real (HU-21, CU-18 y CU-18a, RF-G06, RN-10, CP-15; ver
// base-temporal.ts): con el temario de las semillas y docentes de Historia, la pregunta pasa a en
// revisión con su versión guardada y dos docentes activos del área que no son su autor ni quien pidió el
// lote, primero los de menos carga, con el plazo de la configuración, su historial y su auditoría. Sin
// docentes del área, la pregunta sigue en borrador. Los casos sin base están en revision-envio.test.ts.
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearServicios, type Servicios } from '../app.js';
import { ejecutarEnTransaccion } from '../db/transaccion.js';
import { ejecutarSemillas } from '../db/semillas.js';
import { esquemaPregunta } from '../modulos/preguntas/preguntas.validadores.js';
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

describe('enviar a revisión sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('enviar a revisión con PostgreSQL (HU-21, CP-15)', () => {
  let base: BaseTemporal;
  let servicios: Servicios;
  const ids = new Map<string, string>();

  const id = (clave: string) => {
    const valor = ids.get(clave);
    if (valor === undefined) throw new Error(`Falta ${clave}.`);
    return valor;
  };

  /** Una cuenta interna con su rol y, si es docente, sus áreas. */
  async function cuenta(
    correo: string,
    rol: string,
    { areas = [] as string[], activo = true } = {},
  ) {
    const usuario = String(
      await uno(
        base.bd,
        `INSERT INTO contenido.usuario_interno (nombre, correo, hash_contrasena, rol_id, activo, creado_en)
         SELECT $1, $1, 'x', id, $3, now() FROM contenido.rol WHERE codigo = $2 RETURNING id`,
        [correo, rol, activo],
      ),
    );
    await base.bd.query(
      `INSERT INTO contenido.docente_especialidad (usuario_interno_id, area_id)
       SELECT $1, id FROM contenido.area WHERE nombre = ANY ($2::text[])`,
      [usuario, areas],
    );
    ids.set(correo, usuario);
    return usuario;
  }

  /** Una pregunta en borrador del primer contenido del área indicada, creada por `autor`. */
  async function pregunta(area: string, autor: string) {
    const { rows } = await base.bd.query<{ prueba: number; contenido: number; habilidad: number }>(
      `SELECT c.prueba_id AS prueba, c.id AS contenido,
              (SELECT min(h.id) FROM contenido.habilidad h WHERE h.prueba_id = c.prueba_id) AS habilidad
         FROM contenido.contenido_tematico c JOIN contenido.area a ON a.id = c.area_id
        JOIN contenido.prueba p ON p.id = c.prueba_id
        WHERE a.nombre = $1 AND p.textos IS NULL
        ORDER BY c.id LIMIT 1`,
      [area],
    );
    const fila = rows[0];
    if (!fila) throw new Error(`No hay contenidos de ${area}.`);
    const datos = esquemaPregunta.parse({
      pruebaId: fila.prueba,
      contenidoId: fila.contenido,
      habilidadId: fila.habilidad,
      tipoPregunta: 'seleccion_multiple',
      enunciado: `Pregunta de ${area}`,
      explicacion: 'Explicación.',
      alternativas: alternativas(4, ['B']),
    });
    return (await servicios.preguntas.crearPregunta(autor, datos)).id;
  }

  /** Los correos de los revisores asignados a la pregunta. */
  async function revisoresDe(preguntaId: string) {
    const { rows } = await base.bd.query<{ correo: string }>(
      `SELECT u.correo FROM contenido.asignacion_revision a
         JOIN contenido.usuario_interno u ON u.id = a.docente_id
        WHERE a.pregunta_id = $1 ORDER BY u.correo`,
      [preguntaId],
    );
    return rows.map((fila) => fila.correo);
  }

  beforeAll(async () => {
    base = await crearBaseTemporal('revision');
    await ejecutarSemillas(base.bd, path.join(import.meta.dirname, '../db/semillas'));
    servicios = crearServicios(
      crearDependenciasDePrueba({
        bd: base.bd,
        unidadDeTrabajo: { enTransaccion: (trabajo) => ejecutarEnTransaccion(base.bd, trabajo) },
      }),
    );
    await cuenta('admin@revision.cl', 'admin');
    await cuenta('h1@revision.cl', 'docente', { areas: ['Historia'] });
    await cuenta('h2@revision.cl', 'docente', { areas: ['Historia', 'Lenguaje'] });
    await cuenta('h3@revision.cl', 'docente', { areas: ['Historia'] });
    await cuenta('inactivo@revision.cl', 'docente', { areas: ['Historia'], activo: false });
    await cuenta('lenguaje@revision.cl', 'docente', { areas: ['Lenguaje'] });
  }, MINUTO);

  afterAll(() => base.cerrar(), MINUTO);

  it('CP-15: pasa a en revisión con su versión y dos docentes activos del área, con plazo, historial y auditoría', async () => {
    const admin = id('admin@revision.cl');
    const preguntaId = await pregunta('Historia', admin);

    const envio = await servicios.revision.enviarARevision(admin, preguntaId);

    expect(envio).toMatchObject({ preguntaId, ronda: 1, version: 1 });
    expect(envio.revisores.map((r) => r.docente.correo)).toEqual([
      'h1@revision.cl',
      'h2@revision.cl',
    ]);
    const { rows: pregunta_ } = await base.bd.query(
      `SELECT e.codigo AS estado, p.ronda_actual AS ronda,
              EXISTS (SELECT 1 FROM contenido.pregunta_version v WHERE v.pregunta_id = p.id AND v.version = 1) AS "versionGuardada"
         FROM contenido.pregunta p JOIN contenido.estado_pregunta e ON e.id = p.estado_pregunta_id
        WHERE p.id = $1`,
      [preguntaId],
    );
    expect(pregunta_).toEqual([{ estado: 'en_revision', ronda: 1, versionGuardada: true }]);
    const { rows: asignaciones } = await base.bd.query(
      `SELECT a.ronda, a.version_revisada AS version, r.codigo AS rol, e.codigo AS estado,
              extract(epoch FROM a.vence_en - a.asignado_en) / 86400 AS dias
         FROM contenido.asignacion_revision a
         JOIN contenido.rol_revision r ON r.id = a.rol_revision_id
         JOIN contenido.estado_asignacion e ON e.id = a.estado_asignacion_id
        WHERE a.pregunta_id = $1`,
      [preguntaId],
    );
    expect(asignaciones).toEqual([
      { ronda: 1, version: 1, rol: 'revisor', estado: 'pendiente', dias: '3.0000000000000000' },
      { ronda: 1, version: 1, rol: 'revisor', estado: 'pendiente', dias: '3.0000000000000000' },
    ]);
    const { rows: historial } = await base.bd.query(
      `SELECT d.codigo AS desde, h_.codigo AS hacia, h.usuario_id::text AS usuario
         FROM contenido.historial_estado_pregunta h
         JOIN contenido.estado_pregunta d ON d.id = h.desde_id
         JOIN contenido.estado_pregunta h_ ON h_.id = h.hacia_id
        WHERE h.pregunta_id = $1`,
      [preguntaId],
    );
    expect(historial).toEqual([{ desde: 'borrador', hacia: 'en_revision', usuario: admin }]);
    const auditoria = await uno(
      base.bd,
      `SELECT a.usuario_id::text AS id FROM contenido.auditoria a
         JOIN contenido.accion_auditoria x ON x.id = a.accion_auditoria_id
        WHERE x.codigo = 'enviar_a_revision' AND a.entidad_id = $1`,
      [preguntaId],
    );
    expect(String(auditoria)).toBe(admin);
  });

  it('CP-15: nunca asigna a su autor ni a quien pidió el lote a la IA, ni a un docente inactivo', async () => {
    const admin = id('admin@revision.cl');
    const deUnDocente = await pregunta('Historia', id('h1@revision.cl'));
    const deLaIa = await pregunta('Historia', admin);
    const lote = String(
      await uno(
        base.bd,
        `INSERT INTO contenido.lote_generacion (contenido_id, solicitante_id, tipo_pregunta_id, cantidad,
                                               modelo, version_instrucciones, estado_lote_id, creado_en)
         SELECT p.contenido_id, $2, p.tipo_pregunta_id, 1, 'simulado', '1', e.id, now()
           FROM contenido.pregunta p, contenido.estado_lote e
          WHERE p.id = $1 AND e.codigo = 'completado' RETURNING id`,
        [deLaIa, id('h2@revision.cl')],
      ),
    );
    await base.bd.query(
      'UPDATE contenido.pregunta SET lote_id = $2, autor_id = NULL WHERE id = $1',
      [deLaIa, lote],
    );

    await servicios.revision.enviarARevision(admin, deUnDocente);
    await servicios.revision.enviarARevision(admin, deLaIa);

    expect(await revisoresDe(deUnDocente)).toEqual(['h2@revision.cl', 'h3@revision.cl']);
    expect(await revisoresDe(deLaIa)).toEqual(['h1@revision.cl', 'h3@revision.cl']);
  });

  it('reparte la carga: elige primero a los docentes con menos revisiones pendientes', async () => {
    const admin = id('admin@revision.cl');
    const { rows } = await base.bd.query<{ correo: string; pendientes: number }>(
      `SELECT u.correo, count(a.id)::int AS pendientes
         FROM contenido.usuario_interno u
         LEFT JOIN contenido.asignacion_revision a ON a.docente_id = u.id
        WHERE u.correo IN ('h1@revision.cl', 'h2@revision.cl', 'h3@revision.cl')
        GROUP BY u.correo, u.id ORDER BY count(a.id), u.id`,
    );
    const preguntaId = await pregunta('Historia', admin);

    await servicios.revision.enviarARevision(admin, preguntaId);

    const esperados = rows
      .slice(0, 2)
      .map((fila) => fila.correo)
      .sort();
    expect(await revisoresDe(preguntaId)).toEqual(esperados);
  });

  it('CP-15: sin dos docentes del área, la pregunta sigue en borrador y se avisa', async () => {
    const admin = id('admin@revision.cl');
    const preguntaId = await pregunta('Matemática', admin);

    await expect(servicios.revision.enviarARevision(admin, preguntaId)).rejects.toThrow(
      'La pregunta no tiene 2 docentes de Matemática disponibles para revisarla: asigna el área a un docente en Usuarios internos.',
    );

    const { rows } = await base.bd.query<{ estado: string }>(
      `SELECT e.codigo AS estado FROM contenido.pregunta p
         JOIN contenido.estado_pregunta e ON e.id = p.estado_pregunta_id WHERE p.id = $1`,
      [preguntaId],
    );
    expect(rows).toEqual([{ estado: 'borrador' }]);
    expect(await revisoresDe(preguntaId)).toEqual([]);
  });

  it('una pregunta que ya está en revisión no se vuelve a enviar', async () => {
    const admin = id('admin@revision.cl');
    const preguntaId = await pregunta('Historia', admin);
    await servicios.revision.enviarARevision(admin, preguntaId);

    await expect(servicios.revision.enviarARevision(admin, preguntaId)).rejects.toThrow(
      'La pregunta está «En revisión»: solo se envían a revisión las preguntas en borrador u observadas.',
    );
    expect(await revisoresDe(preguntaId)).toHaveLength(2);
  });
});
