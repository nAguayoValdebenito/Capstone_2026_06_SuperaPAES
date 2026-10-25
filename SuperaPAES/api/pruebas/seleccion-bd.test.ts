// HU-31.3: CP-19 pasos 1,2,5,6 y CP-20 paso 1. Operación de lectura sin evaluación persistida.
import { describe, expect, it, vi } from 'vitest';
import { registro } from '../comun/registro.js';
import { calcularCuotas } from '../modulos/evaluaciones/evaluaciones.cuotas.js';
import type { CodigoDificultad } from '../modulos/evaluaciones/evaluaciones.seleccion.tipos.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararSeleccion, seleccionarTodas } from './base-seleccion.js';
import { crearPreguntaPublicada } from './preguntas-de-prueba.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('selección con PostgreSQL (CP-19 y CP-20)', () => {
  const entorno = prepararSeleccion('seleccion');
  const banco = async (dificultad: CodigoDificultad, cantidad: number, contenidoId?: number) => {
    const preguntas = [];
    for (let i = 0; i < cantidad; i++)
      preguntas.push(
        await crearPreguntaPublicada(entorno.bd, {
          prueba: 'M1',
          dificultad,
          ...(contenidoId && { contenidoId }),
        }),
      );
    return preguntas;
  };
  const completo = async () => {
    for (const dificultad of ['facil', 'media', 'dificil'] as const) await banco(dificultad, 20);
  };

  it('CP-19 pasos 1 y 2: cinco prácticas de 20 dan 6/9/5 sin crear evaluaciones ni repetir', async () => {
    await completo();
    const datos = await entorno.datos();
    for (let semilla = 1; semilla <= 5; semilla++) {
      let estado = semilla;
      const azar = () => {
        estado = (estado * 16807) % 2147483647;
        return estado / 2147483647;
      };
      const preguntas = await seleccionarTodas(entorno.servicio(azar), datos);
      expect(preguntas).toHaveLength(20);
      expect(new Set(preguntas.map((p) => p.preguntaId)).size).toBe(20);
      const { rows } = await entorno.bd.query<{ dificultad: string; n: number }>(
        `SELECT dificultad, count(*)::int AS n FROM contenido.v_preguntas_publicadas WHERE id = ANY($1::bigint[]) GROUP BY dificultad`,
        [preguntas.map((p) => p.preguntaId)],
      );
      expect(Object.fromEntries(rows.map((r) => [r.dificultad, r.n]))).toEqual({
        facil: 6,
        media: 9,
        dificil: 5,
      });
    }
    const {
      rows: [fila],
    } = await entorno.bd.query('SELECT count(*)::int AS n FROM app.evaluacion');
    expect(fila.n).toBe(0);
  });

  it('CP-19 paso 6: dificultad explícita no se sustituye aunque no alcance', async () => {
    await banco('facil', 20);
    const dificiles = await banco('dificil', 2);
    const datos = { ...(await entorno.datos()), dificultad: 'dificil' as const };
    expect(await entorno.servicio().contarDisponibles(datos)).toBe(2);
    expect(await seleccionarTodas(entorno.servicio(), datos)).toEqual(
      dificiles.map(({ preguntaId, version }) => ({ preguntaId, version })),
    );
  });

  it('lee la mezcla de la base: cambiarla a 30/40/30 produce 6/8/6', async () => {
    await completo();
    try {
      await entorno.bd.query('BEGIN');
      await entorno.bd.query(
        `UPDATE contenido.dificultad SET mezcla_objetivo = CASE codigo WHEN 'media' THEN 40 ELSE 30 END`,
      );
      await entorno.bd.query('COMMIT');
      const datos = await entorno.datos();
      const elegidas = await seleccionarTodas(entorno.servicio(), datos);
      const { rows } = await entorno.bd.query<{ dificultad: string; n: number }>(
        `SELECT dificultad, count(*)::int AS n FROM contenido.v_preguntas_publicadas WHERE id = ANY($1::bigint[]) GROUP BY dificultad`,
        [elegidas.map((p) => p.preguntaId)],
      );
      expect(Object.fromEntries(rows.map((r) => [r.dificultad, r.n]))).toEqual({
        facil: 6,
        media: 8,
        dificil: 6,
      });
    } finally {
      await entorno.bd.query('ROLLBACK');
      await entorno.bd.query(
        `UPDATE contenido.dificultad SET mezcla_objetivo = CASE codigo WHEN 'facil' THEN 30 WHEN 'media' THEN 45 ELSE 25 END`,
      );
    }
  });

  it('redistribuye una cuota agotada a la dificultad más cercana', async () => {
    await banco('facil', 20);
    await banco('media', 20);
    const preguntas = await seleccionarTodas(entorno.servicio(), await entorno.datos());
    expect(preguntas).toHaveLength(20);
    const {
      rows: [fila],
    } = await entorno.bd.query(
      "SELECT count(*)::int AS n FROM contenido.v_preguntas_publicadas WHERE id = ANY($1::bigint[]) AND dificultad = 'media'",
      [preguntas.map((p) => p.preguntaId)],
    );
    expect(fila.n).toBe(14);
  });

  it('cuenta y elige con los mismos filtros de alcance, exclusión y estado publicado', async () => {
    const [p, otra] = await banco('media', 2);
    expect(p).toBeDefined();
    await entorno.bd.query(
      `UPDATE contenido.pregunta SET estado_pregunta_id = (SELECT id FROM contenido.estado_pregunta WHERE codigo='retirada') WHERE id=$1`,
      [otra!.preguntaId],
    );
    const datos = { ...(await entorno.datos()), contenidoId: p!.contenidoId };
    expect(await entorno.servicio().contarDisponibles(datos)).toBe(1);
    const elegida = await entorno.servicio().elegirSiguiente(datos);
    expect(elegida).toEqual({ preguntaId: p!.preguntaId, version: p!.version });
    expect(await entorno.servicio().contarDisponibles({ ...datos, entregadas: [elegida!] })).toBe(
      0,
    );
    expect(
      await entorno.servicio().elegirSiguiente({ ...datos, entregadas: [elegida!] }),
    ).toBeNull();
    expect(await entorno.servicio().contarDisponibles({ ...datos, contenidoId: -1 })).toBe(0);
  });

  it('rechaza alcances incompatibles y respeta la cantidad original y las cuotas preparadas', async () => {
    await completo();
    const datos = await entorno.datos('M1', 5);
    await expect(
      entorno.servicio().contarDisponibles({ ...datos, ejeId: 1, contenidoId: 1 }),
    ).rejects.toThrow();
    const cuotas = calcularCuotas(5, [
      { codigo: 'facil', objetivo: 0 },
      { codigo: 'media', objetivo: 100 },
      { codigo: 'dificil', objetivo: 0 },
    ]);
    const elegidas = await seleccionarTodas(entorno.servicio(), { ...datos, cuotas });
    expect(elegidas).toHaveLength(5);
    expect(await entorno.servicio().elegirSiguiente({ ...datos, entregadas: elegidas })).toBeNull();
    const { rows } = await entorno.bd.query(
      'SELECT dificultad FROM contenido.v_preguntas_publicadas WHERE id=ANY($1::bigint[])',
      [elegidas.map((p) => p.preguntaId)],
    );
    expect(rows.every((r) => r.dificultad === 'media')).toBe(true);
  });

  it('CP-20 paso 1: resultado y registros no contienen la clave ni explicaciones', async () => {
    await banco('media', 1);
    const info = vi.spyOn(registro, 'info');
    const error = vi.spyOn(registro, 'error');
    const resultado = await entorno.servicio().elegirSiguiente(await entorno.datos());
    expect(Object.keys(resultado!).sort()).toEqual(['preguntaId', 'version']);
    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    const {
      rows: [fila],
    } = await entorno.bd.query('SELECT count(*)::int AS n FROM app.evaluacion_item');
    expect(fila.n).toBe(0);
  });
});
