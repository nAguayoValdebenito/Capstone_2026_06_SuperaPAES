// Publicar, retirar y volver a borrador contra PostgreSQL real (HU-24, CU-21, RF-G09, RF-G10, RN-13;
// ver base-temporal.ts): una pregunta de Historia pasa por la revisión (HU-21 a HU-23) y queda aprobada
// con dificultad media; al publicarla aparece en las preguntas que ve la app (v_preguntas_publicadas), al
// retirarla deja de aparecer y una retirada vuelve a borrador. Publicar y retirar quedan en la auditoría
// y cada cambio en el historial, a nombre del administrador.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Servicios } from '../app.js';
import { type BaseTemporal, exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';
import {
  aprobarPregunta,
  crearCuenta,
  crearPreguntaDeHistoria,
  pautaActiva,
  prepararBaseDeRevision,
  temarioDeHistoria,
} from './revision-bd.js';

describe('publicar y retirar sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('publicar y retirar con PostgreSQL (HU-24)', () => {
  let base: BaseTemporal;
  let servicios: Servicios;
  let admin = '';
  let pauta: string[] = [];
  let temario = { prueba: 0, contenido: 0, habilidad: 0 };

  const nueva = (enunciado: string) =>
    crearPreguntaDeHistoria(servicios, temario, [admin, enunciado]);

  /** Envía la pregunta a revisión y sus dos revisores la aprueban con dificultad media. */
  async function aprobada(enunciado: string): Promise<string> {
    const id = await nueva(enunciado);
    await aprobarPregunta(servicios, [admin, id], [pauta, 'media']);
    return id;
  }

  const enLaApp = async (id: string) =>
    (await base.bd.query('SELECT 1 FROM contenido.v_preguntas_publicadas WHERE id = $1', [id]))
      .rowCount === 1;

  const auditoria = async (id: string) =>
    (
      await base.bd.query<{ accion: string; usuario: string }>(
        `SELECT a.codigo AS accion, au.usuario_id::text AS usuario
           FROM contenido.auditoria au
           JOIN contenido.accion_auditoria a ON a.id = au.accion_auditoria_id
          WHERE au.entidad = 'pregunta' AND au.entidad_id = $1
            AND a.codigo IN ('publicar_pregunta', 'retirar_pregunta')
          ORDER BY au.id`,
        [id],
      )
    ).rows;

  const ultimoCambio = async (id: string) =>
    (
      await base.bd.query<{ hacia: string; usuario: string }>(
        `SELECT e.codigo AS hacia, h.usuario_id::text AS usuario
           FROM contenido.historial_estado_pregunta h
           JOIN contenido.estado_pregunta e ON e.id = h.hacia_id
          WHERE h.pregunta_id = $1 ORDER BY h.id DESC LIMIT 1`,
        [id],
      )
    ).rows[0];

  beforeAll(async () => {
    ({ base, servicios } = await prepararBaseDeRevision('publicacion'));
    admin = await crearCuenta(base.bd, ['admin@publicacion.cl', 'admin']);
    for (const correo of ['h1@publicacion.cl', 'h2@publicacion.cl']) {
      await crearCuenta(base.bd, [correo, 'docente'], ['Historia']);
    }
    pauta = await pautaActiva(base.bd);
    temario = await temarioDeHistoria(base.bd);
  }, MINUTO);

  afterAll(() => base.cerrar(), MINUTO);

  it('publicada llega a la app, retirada deja de llegar y vuelve a borrador; todo con su registro', async () => {
    const id = await aprobada('¿Se publica?');

    const publicada = await servicios.preguntas.cambiarEtapa(admin, id, 'publicar');
    const visibleAlPublicar = await enLaApp(id);
    const retirada = await servicios.preguntas.cambiarEtapa(admin, id, 'retirar');
    const visibleAlRetirar = await enLaApp(id);
    const enBorrador = await servicios.preguntas.cambiarEtapa(admin, id, 'borrador');

    expect([publicada, retirada, enBorrador].map((p) => p.estado.codigo)).toEqual([
      'publicada',
      'retirada',
      'borrador',
    ]);
    expect(visibleAlPublicar).toBe(true);
    expect(visibleAlRetirar).toBe(false);
    expect(await auditoria(id)).toEqual([
      { accion: 'publicar_pregunta', usuario: admin },
      { accion: 'retirar_pregunta', usuario: admin },
    ]);
    expect(await ultimoCambio(id)).toEqual({ hacia: 'borrador', usuario: admin });
    const { rows } = await base.bd.query<{ editable: boolean }>(
      `SELECT e.editable FROM contenido.pregunta p
         JOIN contenido.estado_pregunta e ON e.id = p.estado_pregunta_id WHERE p.id = $1`,
      [id],
    );
    expect(rows).toEqual([{ editable: true }]);
  });

  it('una pregunta en borrador no se publica ni se retira', async () => {
    const id = await nueva('¿Se publica sin revisión?');

    await expect(servicios.preguntas.cambiarEtapa(admin, id, 'publicar')).rejects.toThrow(
      'La pregunta está «Borrador»: solo se publican preguntas aprobadas.',
    );
    await expect(servicios.preguntas.cambiarEtapa(admin, id, 'retirar')).rejects.toThrow(
      'La pregunta está «Borrador»: solo se retiran preguntas publicadas.',
    );
    expect(await enLaApp(id)).toBe(false);
    expect(await auditoria(id)).toEqual([]);
  });
});
