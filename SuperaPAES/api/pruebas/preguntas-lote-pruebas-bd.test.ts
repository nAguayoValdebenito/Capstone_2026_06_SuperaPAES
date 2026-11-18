// Acciones en lote del banco con PostgreSQL real (ver base-temporal.ts), clic tras clic: enviar a revisión
// y publicar sin revisión procesan 10 preguntas por vez del filtro del banco, en todo el banco; el clic
// siguiente toma las 10 siguientes y así hasta que no queda ninguna. El envío asigna dos docentes como el
// de una (RN-10); la publicación deja la pregunta en la app con dificultad asignada, su historial por las
// etapas que permite la base y la auditoría «publicar_sin_revision».
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

  /** El filtro del banco por la prueba de Historia, como llega validado de la URL. */
  const filtros = () => ({ prueba: temario.prueba, pagina: 1, porPagina: 20 });

  const borradores = async (cantidad: number, prefijo: string) => {
    const ids: string[] = [];
    for (let i = 1; i <= cantidad; i++) {
      const enunciado = `¿${prefijo} ${String(i)}?`;
      ids.push(await crearPreguntaDeHistoria(servicios, temario, [admin, enunciado]));
    }
    return ids;
  };

  const etapas = async (ids: readonly string[]) =>
    (
      await base.bd.query<{ estado: string }>(
        `SELECT e.codigo AS estado FROM contenido.pregunta p
           JOIN contenido.estado_pregunta e ON e.id = p.estado_pregunta_id
          WHERE p.id = ANY ($1::bigint[]) ORDER BY p.id`,
        [ids],
      )
    ).rows.map((fila) => fila.estado);

  beforeAll(async () => {
    ({ base, servicios } = await prepararBaseDeRevision('lote_pruebas'));
    admin = await crearCuenta(base.bd, ['admin@lote.cl', 'admin']);
    for (const correo of ['h1@lote.cl', 'h2@lote.cl']) {
      await crearCuenta(base.bd, [correo, 'docente'], ['Historia']);
    }
    temario = await temarioDeHistoria(base.bd);
  }, MINUTO);

  afterAll(() => base.cerrar(), MINUTO);

  it(
    'envía a revisión de 10 en 10, clic tras clic, hasta que no queda ninguna',
    async () => {
      const ids = await borradores(12, 'Revisión');
      expect((await servicios.preguntas.contarLote(filtros())).paraRevision).toBe(12);

      const primero = await servicios.revision.enviarLoteARevision(admin, filtros());
      const segundo = await servicios.revision.enviarLoteARevision(admin, filtros());
      const tercero = await servicios.revision.enviarLoteARevision(admin, filtros());

      expect(primero.enviadas).toHaveLength(10);
      expect(primero.enviadas.every((envio) => envio.revisores.length === 2)).toBe(true);
      expect(segundo.enviadas).toHaveLength(2);
      expect(tercero).toEqual({ enviadas: [], noEnviadas: [] });
      expect(new Set(await etapas(ids))).toEqual(new Set(['en_revision']));
      expect((await servicios.preguntas.contarLote(filtros())).paraRevision).toBe(0);
    },
    MINUTO,
  );

  it(
    'publica sin revisión de 10 en 10, clic tras clic, con historial y auditoría',
    async () => {
      const ids = await borradores(12, 'Publicar');
      expect((await servicios.preguntas.contarLote(filtros())).paraPublicar).toBe(12);

      const primero = await servicios.preguntas.publicarSinRevision(admin, filtros());
      const segundo = await servicios.preguntas.publicarSinRevision(admin, filtros());
      const tercero = await servicios.preguntas.publicarSinRevision(admin, filtros());

      expect(primero.publicadas).toHaveLength(10);
      expect(segundo.publicadas).toHaveLength(2);
      expect(tercero).toEqual({ publicadas: [], noPublicadas: [] });
      expect(new Set(await etapas(ids))).toEqual(new Set(['publicada']));
      const enLaApp = await base.bd.query(
        'SELECT 1 FROM contenido.v_preguntas_publicadas WHERE id = ANY ($1::bigint[])',
        [ids],
      );
      expect(enLaApp.rowCount).toBe(12);
      const historial = await base.bd.query<{ hacia: string }>(
        `SELECT e.codigo AS hacia FROM contenido.historial_estado_pregunta h
         JOIN contenido.estado_pregunta e ON e.id = h.hacia_id
        WHERE h.pregunta_id = $1 AND h.desde_id IS NOT NULL ORDER BY h.id`,
        [ids[0]],
      );
      expect(historial.rows.map((fila) => fila.hacia)).toEqual([
        'en_revision',
        'aprobada',
        'publicada',
      ]);
      const auditoria = await base.bd.query<{ accion: string }>(
        `SELECT a.codigo AS accion FROM contenido.auditoria au
         JOIN contenido.accion_auditoria a ON a.id = au.accion_auditoria_id
        WHERE au.entidad = 'pregunta' AND au.entidad_id = $1`,
        [ids[0]],
      );
      expect(auditoria.rows.map((fila) => fila.accion)).toContain('publicar_sin_revision');
      expect((await servicios.preguntas.contarLote(filtros())).paraPublicar).toBe(0);
    },
    MINUTO,
  );

  it(
    'una con dificultad ya asignada la conserva y se retira como cualquier publicada',
    async () => {
      const [id = ''] = await borradores(1, 'Con dificultad');
      await base.bd.query(
        `UPDATE contenido.pregunta
          SET dificultad_asignada_id = (SELECT id FROM contenido.dificultad WHERE codigo = 'dificil')
        WHERE id = $1`,
        [id],
      );

      const lote = await servicios.preguntas.publicarSinRevision(admin, filtros());
      const retirada = await servicios.preguntas.cambiarEtapa(admin, id, 'retirar');

      expect(lote.publicadas).toEqual([id]);
      const dificultad = await base.bd.query<{ codigo: string }>(
        `SELECT d.codigo FROM contenido.pregunta p
         JOIN contenido.dificultad d ON d.id = p.dificultad_asignada_id
        WHERE p.id = $1`,
        [id],
      );
      expect(dificultad.rows[0]?.codigo).toBe('dificil');
      expect(retirada.estado.codigo).toBe('retirada');
    },
    MINUTO,
  );
});
