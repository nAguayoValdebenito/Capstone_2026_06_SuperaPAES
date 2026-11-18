// Acciones en lote del banco con PostgreSQL real (ver base-temporal.ts): enviar a revisión varias
// preguntas a la vez les asigna sus dos docentes como el envío de una (RN-10), y publicar sin revisión
// (modo de pruebas) deja la pregunta en la app con dificultad asignada, su historial por las etapas que
// permite la base y la auditoría «publicar_sin_revision». Las que no se pueden quedan como estaban.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Servicios } from '../app.js';
import { type BaseTemporal, exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';
import {
  crearCuenta,
  crearPreguntaDeHistoria,
  prepararBaseDeRevision,
  temarioDeHistoria,
} from './revision-bd.js';

describe('acciones en lote sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('acciones en lote del banco con PostgreSQL', () => {
  let base: BaseTemporal;
  let servicios: Servicios;
  let admin = '';
  let temario = { prueba: 0, contenido: 0, habilidad: 0 };

  const nueva = (enunciado: string) =>
    crearPreguntaDeHistoria(servicios, temario, [admin, enunciado]);

  const etapa = async (id: string) =>
    (
      await base.bd.query<{ estado: string; dificultad: string | null }>(
        `SELECT e.codigo AS estado, d.codigo AS dificultad
           FROM contenido.pregunta p
           JOIN contenido.estado_pregunta e ON e.id = p.estado_pregunta_id
           LEFT JOIN contenido.dificultad d ON d.id = p.dificultad_asignada_id
          WHERE p.id = $1`,
        [id],
      )
    ).rows[0];

  const enLaApp = async (id: string) =>
    (await base.bd.query('SELECT 1 FROM contenido.v_preguntas_publicadas WHERE id = $1', [id]))
      .rowCount === 1;

  beforeAll(async () => {
    ({ base, servicios } = await prepararBaseDeRevision('lote_pruebas'));
    admin = await crearCuenta(base.bd, ['admin@lote.cl', 'admin']);
    for (const correo of ['h1@lote.cl', 'h2@lote.cl']) {
      await crearCuenta(base.bd, [correo, 'docente'], ['Historia']);
    }
    temario = await temarioDeHistoria(base.bd);
  }, MINUTO);

  afterAll(() => base.cerrar(), MINUTO);

  it('envía a revisión las del lote con sus dos docentes y dice por qué no las demás', async () => {
    const [primera, segunda] = [await nueva('¿Lote 1?'), await nueva('¿Lote 2?')];
    await servicios.revision.enviarARevision(admin, segunda);

    const lote = await servicios.revision.enviarLoteARevision(admin, [primera, segunda]);

    expect(lote.enviadas.map((envio) => envio.preguntaId)).toEqual([primera]);
    expect(lote.enviadas[0]?.revisores).toHaveLength(2);
    expect(lote.noEnviadas).toEqual([{ id: segunda, motivo: expect.any(String) as string }]);
    expect((await etapa(primera))?.estado).toBe('en_revision');
  });

  it('publica sin revisión un borrador: llega a la app, con dificultad y su auditoría', async () => {
    const borrador = await nueva('¿Sin revisión?');
    const enRevision = await nueva('¿Ya en revisión?');
    await servicios.revision.enviarARevision(admin, enRevision);

    const lote = await servicios.preguntas.publicarSinRevision(admin, [borrador, enRevision]);

    expect(lote.publicadas).toEqual([borrador]);
    expect(lote.noPublicadas).toEqual([
      {
        id: enRevision,
        motivo: expect.stringContaining('solo se publican sin revisión') as string,
      },
    ]);
    expect(await etapa(borrador)).toEqual({ estado: 'publicada', dificultad: 'media' });
    expect(await enLaApp(borrador)).toBe(true);
    expect((await etapa(enRevision))?.estado).toBe('en_revision');
    const historial = await base.bd.query<{ hacia: string; usuario: string }>(
      `SELECT e.codigo AS hacia, h.usuario_id::text AS usuario
         FROM contenido.historial_estado_pregunta h
         JOIN contenido.estado_pregunta e ON e.id = h.hacia_id
        WHERE h.pregunta_id = $1 AND h.desde_id IS NOT NULL ORDER BY h.id`,
      [borrador],
    );
    expect(historial.rows).toEqual(
      ['en_revision', 'aprobada', 'publicada'].map((hacia) => ({ hacia, usuario: admin })),
    );
    const auditoria = await base.bd.query<{ accion: string }>(
      `SELECT a.codigo AS accion FROM contenido.auditoria au
         JOIN contenido.accion_auditoria a ON a.id = au.accion_auditoria_id
        WHERE au.entidad = 'pregunta' AND au.entidad_id = $1`,
      [borrador],
    );
    expect(auditoria.rows.map((fila) => fila.accion)).toContain('publicar_sin_revision');
  });

  it('una publicada sin revisión se retira desde el banco como cualquier publicada', async () => {
    const id = await nueva('¿Se retira?');
    await servicios.preguntas.publicarSinRevision(admin, [id]);

    const retirada = await servicios.preguntas.cambiarEtapa(admin, id, 'retirar');

    expect(retirada.estado.codigo).toBe('retirada');
    expect(await enLaApp(id)).toBe(false);
  });
});
