// Seguimiento de las revisiones contra PostgreSQL real (C06, HU-21 y HU-23): cada pregunta cae en su grupo, con
// sus revisores, lo que decidieron y el desempate. Una revisión fuera de plazo se ve vencida y un área sin
// docentes suficientes se avisa.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Servicios } from '../app.js';
import { esquemaRevision } from '../modulos/revision/revision.validadores.js';
import { exigirBaseEnCi, urlBase, type BaseTemporal, MINUTO } from './base-temporal.js';
import {
  aprobarPregunta,
  crearCuenta,
  crearPreguntaDeHistoria,
  pautaActiva,
  prepararBaseDeRevision,
  temarioDeHistoria,
} from './revision-bd.js';

const HISTORIA = 'Historia';

describe('seguimiento de las revisiones sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('seguimiento de las revisiones con PostgreSQL (C06)', () => {
  let base: BaseTemporal;
  let servicios: Servicios;
  let admin: string;
  let pauta: string[];
  let temario: Awaited<ReturnType<typeof temarioDeHistoria>>;

  beforeAll(async () => {
    ({ base, servicios } = await prepararBaseDeRevision('seguimiento'));
    admin = await crearCuenta(base.bd, ['admin@ejemplo.cl', 'admin']);
    temario = await temarioDeHistoria(base.bd);
    pauta = await pautaActiva(base.bd);
  }, MINUTO);

  afterAll(() => base.cerrar(), MINUTO);

  const ver = (grupo: 'en_curso' | 'en_desempate' | 'vencidas' | 'terminadas') =>
    servicios.revision.listarSeguimiento({ grupo, pagina: 1, porPagina: 20 });
  const pregunta = (enunciado: string) =>
    crearPreguntaDeHistoria(servicios, temario, [admin, enunciado]);

  async function docentes(area: string, ...correos: string[]) {
    for (const correo of correos) await crearCuenta(base.bd, [correo, 'docente'], [area]);
  }

  it('avisa del área sin docentes suficientes para sus borradores', async () => {
    await pregunta('¿Sin docentes?');

    const { seguimiento } = await ver('en_curso');

    expect(seguimiento.sinDocentes).toEqual([{ area: HISTORIA, preguntas: 1 }]);
    expect(seguimiento.plazoDias).toBe(3);
  });

  it('una pregunta enviada queda en curso, con sus dos revisores pendientes y su plazo', async () => {
    await docentes(HISTORIA, 'uno@ejemplo.cl', 'dos@ejemplo.cl', 'tres@ejemplo.cl');
    const id = await pregunta('¿En curso?');

    await servicios.revision.enviarARevision(admin, id);
    const { seguimiento, paginacion } = await ver('en_curso');

    expect(paginacion.total).toBe(1);
    expect(seguimiento.conteos.en_curso).toBe(1);
    const [fila] = seguimiento.preguntas;
    expect(fila).toMatchObject({ id, estado: { codigo: 'en_revision' }, desempate: null });
    expect(fila?.revisores.map((r) => r.estado)).toEqual(['pendiente', 'pendiente']);
    expect(fila?.venceEn).toBeInstanceOf(Date);
  });

  it('una revisión fuera de plazo pasa a vencidas', async () => {
    const id = await pregunta('¿Vencida?');
    await servicios.revision.enviarARevision(admin, id);

    await base.bd.query(
      `UPDATE contenido.asignacion_revision SET asignado_en = now() - interval '5 days',
              vence_en = now() - interval '1 day' WHERE pregunta_id = $1`,
      [id],
    );
    const { seguimiento } = await ver('vencidas');

    expect(seguimiento.preguntas.map((p) => p.id)).toEqual([id]);
    await base.bd.query(
      `UPDATE contenido.asignacion_revision SET vence_en = now() + interval '1 day' WHERE pregunta_id = $1`,
      [id],
    );
  });

  it('dos aprobaciones iguales terminan la pregunta, con su decisión y dificultad', async () => {
    const id = await pregunta('¿Terminada?');

    await aprobarPregunta(servicios, [admin, id], [pauta, 'media']);
    const { seguimiento } = await ver('terminadas');

    const fila = seguimiento.preguntas.find((p) => p.id === id);
    expect(fila?.estado.codigo).toBe('aprobada');
    expect(fila?.venceEn).toBeNull();
    expect(fila?.revisores).toEqual([
      expect.objectContaining({ decision: 'aprobar', dificultad: 'Media' }),
      expect.objectContaining({ decision: 'aprobar', dificultad: 'Media' }),
    ]);
  });

  it('dos dificultades distintas pasan a desempate, con su tercer docente', async () => {
    const id = await pregunta('¿Desempate?');
    const envio = await servicios.revision.enviarARevision(admin, id);

    for (const [i, { asignacionId, docente }] of envio.revisores.entries()) {
      await servicios.revision.entregarRevision(
        docente.id,
        asignacionId,
        esquemaRevision.parse({
          criterios: pauta.map((codigo) => ({ codigo, cumple: true })),
          dificultad: i === 0 ? 'facil' : 'dificil',
          decision: 'aprobar',
        }),
      );
    }
    const { seguimiento } = await ver('en_desempate');

    const fila = seguimiento.preguntas.find((p) => p.id === id);
    expect(fila?.desempate?.estado).toBe('pendiente');
    expect(fila?.revisores.map((r) => r.dificultad).sort()).toEqual(['Difícil', 'Fácil']);
  });
});
