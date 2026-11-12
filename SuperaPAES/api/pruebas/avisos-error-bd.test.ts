// Bandeja y cierre de los avisos de error contra PostgreSQL real (HU-50.1, RF-C08, CU-26; ver
// base-temporal.ts). HU-37 (el estudiante envía el aviso) está pendiente: los avisos se crean aquí
// directo en la base (decisión D1 de docs/planes/hu-50-avisos-error.md), sobre preguntas de Historia
// publicadas y en la versión que vio el estudiante.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Servicios } from '../app.js';
import { ejecutarEnTransaccion } from '../db/transaccion.js';
import { crearPreguntasServicio } from '../modulos/preguntas/index.js';
import { esquemaFiltrosAvisos } from '../modulos/preguntas/preguntas.validadores.js';
import { type BaseTemporal, exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';
import {
  aprobarPregunta,
  crearCuenta,
  crearPreguntaDeHistoria,
  pautaActiva,
  prepararBaseDeRevision,
  temarioDeHistoria,
} from './revision-bd.js';

describe('avisos de error sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('avisos de error con PostgreSQL (HU-50.1)', () => {
  let base: BaseTemporal;
  let servicios: Servicios;
  let admin = '';
  let estudiante = '';
  /** Pregunta con dos avisos pendientes (los más recientes) y otra con uno, más antiguo. */
  let conDos = '';
  let conUno = '';
  const avisos: Record<string, string> = {};

  async function publicada(enunciado: string, pauta: string[], temario: TemarioHistoria) {
    const id = await crearPreguntaDeHistoria(servicios, temario, [admin, enunciado]);
    await aprobarPregunta(servicios, [admin, id], [pauta, 'media']);
    await servicios.preguntas.cambiarEtapa(admin, id, 'publicar');
    return id;
  }

  /** Inserta un aviso pendiente del estudiante sobre la versión actual de la pregunta. */
  async function avisar(preguntaId: string, [motivo, creadoEn]: [string, string]) {
    const { rows } = await base.bd.query<{ id: string }>(
      `INSERT INTO app.reporte_pregunta (estudiante_id, pregunta_id, version_pregunta, motivo_reporte_id,
                                         comentario, estado_reporte_id, creado_en)
       SELECT $1, p.id, p.version, (SELECT id FROM contenido.motivo_reporte WHERE codigo = $3),
              'Comentario de prueba.', (SELECT id FROM contenido.estado_reporte WHERE codigo = 'pendiente'), $4
         FROM contenido.pregunta p WHERE p.id = $2
       RETURNING id::text`,
      [estudiante, preguntaId, motivo, creadoEn],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('No se creó el aviso.');
    return id;
  }

  const filtros = (consulta: Record<string, string> = {}) => esquemaFiltrosAvisos.parse(consulta);

  const fila = async (id: string) =>
    (
      await base.bd.query<{ estado: string; resueltoPor: string | null; resuelto: boolean }>(
        `SELECT e.codigo AS estado, r.resuelto_por::text AS "resueltoPor",
                r.resuelto_en IS NOT NULL AS resuelto
           FROM app.reporte_pregunta r JOIN contenido.estado_reporte e ON e.id = r.estado_reporte_id
          WHERE r.id = $1`,
        [id],
      )
    ).rows[0];

  const auditoria = async (id: string) =>
    (
      await base.bd.query<{ usuario: string; antes: unknown; despues: unknown }>(
        `SELECT au.usuario_id::text AS usuario, au.antes, au.despues
           FROM contenido.auditoria au JOIN contenido.accion_auditoria a ON a.id = au.accion_auditoria_id
          WHERE a.codigo = 'atender_reporte' AND au.entidad = 'reporte_pregunta' AND au.entidad_id = $1`,
        [id],
      )
    ).rows;

  beforeAll(async () => {
    ({ base, servicios } = await prepararBaseDeRevision('avisos'));
    admin = await crearCuenta(base.bd, ['admin@avisos.cl', 'admin']);
    for (const correo of ['h1@avisos.cl', 'h2@avisos.cl']) {
      await crearCuenta(base.bd, [correo, 'docente'], ['Historia']);
    }
    const pauta = await pautaActiva(base.bd);
    const temario = await temarioDeHistoria(base.bd);
    estudiante = await crearEstudianteDePrueba(base.bd, {
      correo: 'eva@avisos.cl',
      contrasena: 'una clave de prueba',
    });
    conDos = await publicada('¿Tiene dos avisos?', pauta, temario);
    conUno = await publicada('¿Tiene un aviso?', pauta, temario);
    avisos['antiguo'] = await avisar(conUno, ['enunciado', '2026-10-10T12:00:00Z']);
    avisos['primero'] = await avisar(conDos, ['respuesta', '2026-10-19T12:00:00Z']);
    avisos['segundo'] = await avisar(conDos, ['respuesta', '2026-10-20T12:00:00Z']);
  }, MINUTO);

  afterAll(() => base.cerrar(), MINUTO);

  it('agrupa los pendientes por pregunta, de la que tiene el aviso más reciente a la más antigua', async () => {
    const { grupos, paginacion } = await servicios.preguntas.listarAvisos(filtros());

    expect(paginacion).toEqual({ pagina: 1, porPagina: 20, total: 2 });
    expect(grupos.map((g) => [g.pregunta.id, g.pendientes, g.avisos.map((a) => a.id)])).toEqual([
      [conDos, 2, [avisos['segundo'], avisos['primero']]],
      [conUno, 1, [avisos['antiguo']]],
    ]);
    expect(grupos[0]?.pregunta.estado.codigo).toBe('publicada');
    expect(grupos[0]?.avisos[0]).toEqual(
      expect.objectContaining({
        motivo: { codigo: 'respuesta', nombre: 'La respuesta correcta está mal' },
        estado: { codigo: 'pendiente', nombre: 'Pendiente' },
        creadoEn: '2026-10-20T12:00:00.000Z',
        resueltoPor: null,
      }),
    );
  });

  it('filtra por motivo y pagina por pregunta', async () => {
    const porMotivo = await servicios.preguntas.listarAvisos(filtros({ motivo: 'enunciado' }));
    const segunda = await servicios.preguntas.listarAvisos(
      filtros({ pagina: '2', porPagina: '1' }),
    );

    expect(porMotivo.grupos.map((g) => g.pregunta.id)).toEqual([conUno]);
    expect(segunda.grupos.map((g) => g.pregunta.id)).toEqual([conUno]);
    expect(segunda.paginacion.total).toBe(2);
  });

  it('si la auditoría falla, el aviso sigue pendiente', async () => {
    const sinAuditoria = crearPreguntasServicio({
      bd: base.bd,
      unidadDeTrabajo: { enTransaccion: (trabajo) => ejecutarEnTransaccion(base.bd, trabajo) },
      temario: servicios.temario,
      administracion: { registrarAuditoria: () => Promise.reject(new Error('auditoría caída')) },
    });

    await expect(
      sinAuditoria.cerrarAviso(admin, avisos['antiguo'] ?? '', 'descartado'),
    ).rejects.toThrow('auditoría caída');
    expect(await fila(avisos['antiguo'] ?? '')).toEqual({
      estado: 'pendiente',
      resueltoPor: null,
      resuelto: false,
    });
  });

  it('cerrar guarda el estado, quién y cuándo, y la auditoría; solo ese aviso', async () => {
    const id = avisos['segundo'] ?? '';

    const cerrado = await servicios.preguntas.cerrarAviso(admin, id, 'resuelto');

    expect(cerrado.estado).toEqual({ codigo: 'resuelto', nombre: 'Resuelto' });
    expect(cerrado.resueltoPor).toBe('admin@avisos.cl');
    expect(cerrado.resueltoEn).not.toBeNull();
    expect(await fila(id)).toEqual({ estado: 'resuelto', resueltoPor: admin, resuelto: true });
    expect(await fila(avisos['primero'] ?? '')).toEqual(
      expect.objectContaining({ estado: 'pendiente' }),
    );
    expect(await auditoria(id)).toEqual([
      { usuario: admin, antes: { estado: 'pendiente' }, despues: { estado: 'resuelto' } },
    ]);
    const { grupos } = await servicios.preguntas.listarAvisos(filtros({ estado: 'todos' }));
    expect(grupos[0]?.pendientes).toBe(1);
    await expect(servicios.preguntas.cerrarAviso(admin, id, 'descartado')).rejects.toThrow(
      'El aviso ya está «Resuelto».',
    );
    expect(await auditoria(id)).toHaveLength(1);
  });
});

type TemarioHistoria = Awaited<ReturnType<typeof temarioDeHistoria>>;
