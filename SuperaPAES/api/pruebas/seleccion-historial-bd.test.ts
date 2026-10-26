// CP-19 pasos 3,4,5: progreso y curso real, con historial que atraviesa los triggers normales.
import { describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { AHORA_SELECCION, prepararSeleccion, seleccionarTodas } from './base-seleccion.js';
import { crearPreguntaPublicada } from './preguntas-de-prueba.js';
import {
  crearPracticaDePrueba,
  insertarEntregaDePrueba,
  registrarRespuestaDePrueba,
} from './historial-seleccion.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('selección: curso e historial (CP-19)', () => {
  const entorno = prepararSeleccion('seleccion_historial');

  it('CP-19 paso 4: acierto hace 29 días se excluye; hace 31 y fallo hace 29 se permiten', async () => {
    const datos = await entorno.datos();
    const preguntas = [];
    for (const [dias, acertada] of [
      [29, true],
      [31, true],
      [29, false],
      [30, true],
    ] as const) {
      const pregunta = await crearPreguntaPublicada(entorno.bd, {
        prueba: 'M1',
        dificultad: 'media',
      });
      preguntas.push(pregunta);
      const fecha = new Date(AHORA_SELECCION.getTime() - dias * 86_400_000);
      await registrarRespuestaDePrueba(entorno.bd, datos, { pregunta, acertada, fecha });
    }
    expect(await entorno.servicio().contarDisponibles(datos)).toBe(2);
    expect(
      (await seleccionarTodas(entorno.servicio(), datos)).map((p) => p.preguntaId).sort(),
    ).toEqual([preguntas[1]!.preguntaId, preguntas[2]!.preguntaId].sort());
    await entorno.bd.query(
      `UPDATE contenido.configuracion SET valor='28' WHERE clave='dias_sin_repetir'`,
    );
    try {
      expect(await entorno.servicio().contarDisponibles(datos)).toBe(4);
    } finally {
      await entorno.bd.query(
        `UPDATE contenido.configuracion SET valor='30' WHERE clave='dias_sin_repetir'`,
      );
    }
  });

  it('CP-19 paso 5: segundo medio excluye tercero y cuarto, el egresado accede a todos', async () => {
    const { rows: contenidos } = await entorno.bd.query<{ id: number; nivel: string }>(
      `SELECT DISTINCT ON(n.codigo) c.id, n.codigo AS nivel FROM contenido.contenido_tematico c
       JOIN contenido.nivel_escolar n ON n.id=c.nivel_escolar_id
       JOIN contenido.prueba p ON p.id=c.prueba_id WHERE p.codigo='M1' ORDER BY n.codigo,c.id`,
    );
    // M1 no incluye necesariamente 4M: el curso del contenido es un dato editable del temario.
    const ids = contenidos.slice(0, 3).map((c) => c.id);
    for (const [i, codigo] of ['2M', '3M', '4M'].entries()) {
      await entorno.bd.query(
        'UPDATE contenido.contenido_tematico SET nivel_escolar_id=(SELECT id FROM contenido.nivel_escolar WHERE codigo=$2) WHERE id=$1',
        [ids[i], codigo],
      );
      await crearPreguntaPublicada(entorno.bd, {
        prueba: 'M1',
        dificultad: 'media',
        contenidoId: ids[i]!,
      });
    }
    const segundo = await entorno.datos();
    expect(await entorno.servicio().contarDisponibles(segundo)).toBe(1);
    const egresado = await entorno.datos('M1', 20, 2025);
    expect(await entorno.servicio().contarDisponibles(egresado)).toBe(3);
    const curso = await entorno.bd.query<{ id: number }>(
      `SELECT id FROM contenido.nivel_escolar WHERE codigo='2M'`,
    );
    expect(
      await entorno
        .servicio()
        .contarDisponibles({ ...egresado, nivelEscolarId: curso.rows[0]!.id }),
    ).toBe(1);
  });

  it('CP-19 paso 3: da diez de veinte al eje débil y reparte sin alterar 6/9/5', async () => {
    const datos = await entorno.datos();
    const { rows: contenidos } = await entorno.bd.query<{ id: number; ejeId: number }>(
      `SELECT DISTINCT ON(e.id) c.id,e.id AS "ejeId" FROM contenido.contenido_tematico c
       JOIN contenido.eje_tematico e ON e.id=c.eje_id WHERE c.prueba_id=$1 ORDER BY e.id,c.id`,
      [datos.pruebaId],
    );
    for (const contenido of contenidos) {
      await entorno.bd.query(
        `UPDATE contenido.contenido_tematico SET nivel_escolar_id=(SELECT id FROM contenido.nivel_escolar WHERE codigo='1M') WHERE id=$1`,
        [contenido.id],
      );
      for (const dificultad of ['facil', 'media', 'dificil'] as const) {
        for (let i = 0; i < 10; i++)
          await crearPreguntaPublicada(entorno.bd, {
            prueba: 'M1',
            dificultad,
            contenidoId: contenido.id,
          });
      }
    }
    const debil = contenidos[0]!;
    for (let i = 0; i < 5; i++) {
      const pregunta = await crearPreguntaPublicada(entorno.bd, {
        prueba: 'M1',
        dificultad: 'media',
        contenidoId: debil.id,
      });
      await registrarRespuestaDePrueba(entorno.bd, datos, {
        pregunta,
        acertada: false,
        fecha: new Date(AHORA_SELECCION.getTime() - 86_400_000),
      });
    }
    const elegidas = await seleccionarTodas(entorno.servicio(), datos);
    const {
      rows: [fila],
    } = await entorno.bd.query(
      `SELECT count(*)::int AS n FROM contenido.v_preguntas_publicadas WHERE id=ANY($1::bigint[]) AND eje_id=$2`,
      [elegidas.map((p) => p.preguntaId), debil.ejeId],
    );
    expect(fila.n).toBe(10);
    const { rows: dificultades } = await entorno.bd.query<{ dificultad: string; n: number }>(
      `SELECT dificultad, count(*)::int AS n FROM contenido.v_preguntas_publicadas
       WHERE id=ANY($1::bigint[]) GROUP BY dificultad`,
      [elegidas.map((p) => p.preguntaId)],
    );
    expect(Object.fromEntries(dificultades.map((d) => [d.dificultad, d.n]))).toEqual({
      facil: 6,
      media: 9,
      dificil: 5,
    });
    const acotadas = await seleccionarTodas(entorno.servicio(), {
      ...datos,
      ejeId: contenidos[1]!.ejeId,
    });
    expect(acotadas).toHaveLength(20);
    const { rows } = await entorno.bd.query(
      'SELECT eje_id FROM contenido.v_preguntas_publicadas WHERE id=ANY($1::bigint[])',
      [acotadas.map((p) => p.preguntaId)],
    );
    expect(rows.every((r) => r.eje_id === contenidos[1]!.ejeId)).toBe(true);
  });

  it('los elegidos pasan tg_item con el mismo curso, alcance y dificultad de una práctica real', async () => {
    const datos = { ...(await entorno.datos('M1', 5)), dificultad: 'media' as const };
    for (let i = 0; i < 5; i++)
      await crearPreguntaPublicada(entorno.bd, { prueba: 'M1', dificultad: 'media' });
    const seleccionadas = await seleccionarTodas(entorno.servicio(), datos);
    expect(seleccionadas).toHaveLength(5);
    const evaluacion = await crearPracticaDePrueba(entorno.bd, datos);
    for (const [i, p] of seleccionadas.entries())
      await insertarEntregaDePrueba(entorno.bd, evaluacion, p, i + 1);
    const {
      rows: [fila],
    } = await entorno.bd.query(
      'SELECT count(*)::int AS n FROM app.evaluacion_item WHERE evaluacion_id=$1',
      [evaluacion],
    );
    expect(fila.n).toBe(5);
  });
});
