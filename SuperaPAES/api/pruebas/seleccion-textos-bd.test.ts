// CP-19 paso 7 y CU-06: selección directa de 30, bloques de textos y habilidades débiles.
import { describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { AHORA_SELECCION, prepararSeleccion, seleccionarTodas } from './base-seleccion.js';
import { crearPreguntaPublicada, crearTextoDePrueba } from './preguntas-de-prueba.js';
import { registrarRespuestaDePrueba } from './historial-seleccion.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('selección de textos (CU-06 y CP-19)', () => {
  const entorno = prepararSeleccion('seleccion_textos');
  async function texto(cantidad: number, habilidadId?: number) {
    const textoId = await crearTextoDePrueba(entorno.bd);
    const preguntas = [];
    for (let i = 1; i <= cantidad; i++)
      preguntas.push(
        await crearPreguntaPublicada(entorno.bd, {
          prueba: 'CL',
          dificultad: i % 2 === 0 ? 'media' : 'facil',
          textoId,
          ordenEnTexto: i,
          ...(habilidadId && { habilidadId }),
        }),
      );
    return preguntas;
  }

  it('mantiene un texto seguido en orden aunque altere la mezcla; no filtra Lectora por curso', async () => {
    const a = await texto(3);
    const b = await texto(3);
    const datos = await entorno.datos('CL', 6);
    expect(await entorno.servicio().contarDisponibles(datos)).toBe(6);
    const elegidas = await seleccionarTodas(entorno.servicio(), datos);
    expect(elegidas.map((p) => p.preguntaId)).toEqual([...a, ...b].map((p) => p.preguntaId));
  });

  it('prefiere el texto que cabe y solo corta uno si ninguno cabe', async () => {
    const largo = await texto(4);
    const corto = await texto(2);
    const datos = await entorno.datos('CL', 3);
    const elegidas = await seleccionarTodas(entorno.servicio(), datos);
    expect(elegidas.map((p) => p.preguntaId)).toEqual([
      corto[0]!.preguntaId,
      corto[1]!.preguntaId,
      largo[0]!.preguntaId,
    ]);
  });

  it('no repite ni reabre un texto agotado y respeta dificultad explícita dentro del texto', async () => {
    const a = await texto(4);
    const datos = { ...(await entorno.datos('CL', 10)), dificultad: 'media' as const };
    expect(await entorno.servicio().contarDisponibles(datos)).toBe(2);
    expect((await seleccionarTodas(entorno.servicio(), datos)).map((p) => p.preguntaId)).toEqual([
      a[1]!.preguntaId,
      a[3]!.preguntaId,
    ]);
  });

  it('CP-19 paso 7: pide 30 sin evaluación y prioriza la habilidad débil sin acotar el alcance', async () => {
    const datos = await entorno.datos('CL', 30);
    const { rows: habilidades } = await entorno.bd.query<{ id: number }>(
      'SELECT id FROM contenido.habilidad WHERE prueba_id=$1 ORDER BY id',
      [datos.pruebaId],
    );
    for (const habilidad of habilidades) {
      for (let i = 0; i < 6; i++) await texto(3, habilidad.id);
    }
    const debiles = await texto(5, habilidades[0]!.id);
    for (const pregunta of debiles)
      await registrarRespuestaDePrueba(entorno.bd, datos, {
        pregunta,
        acertada: false,
        fecha: new Date(AHORA_SELECCION.getTime() - 86_400_000),
      });
    const elegidas = await seleccionarTodas(entorno.servicio(), datos);
    expect(elegidas).toHaveLength(30);
    const {
      rows: [fila],
    } = await entorno.bd.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM contenido.pregunta WHERE id=ANY($1::bigint[]) AND habilidad_id=$2`,
      [elegidas.map((p) => p.preguntaId), habilidades[0]!.id],
    );
    expect(fila!.n).toBeGreaterThan(10); // Sin prioridad serían 10 de cada una de las tres habilidades.
    await entorno.bd.query(
      `UPDATE contenido.configuracion SET valor='6' WHERE clave='min_respuestas_eje'`,
    );
    try {
      const sinDebilidad = await seleccionarTodas(entorno.servicio(), datos);
      const {
        rows: [sin],
      } = await entorno.bd.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM contenido.pregunta WHERE id=ANY($1::bigint[]) AND habilidad_id=$2`,
        [sinDebilidad.map((p) => p.preguntaId), habilidades[0]!.id],
      );
      expect(sin!.n).toBeLessThan(fila!.n);
    } finally {
      await entorno.bd.query(
        `UPDATE contenido.configuracion SET valor='5' WHERE clave='min_respuestas_eje'`,
      );
    }
  });
  it('el alcance por habilidad limita todo el texto a las preguntas elegibles', async () => {
    const datos = await entorno.datos('CL', 5);
    const { rows: habilidades } = await entorno.bd.query<{ id: number }>(
      'SELECT id FROM contenido.habilidad WHERE prueba_id=$1 ORDER BY id',
      [datos.pruebaId],
    );
    const otras = await texto(3, habilidades[0]!.id);
    const propias = await texto(3, habilidades[1]!.id);
    const acotada = { ...datos, habilidadId: habilidades[1]!.id };
    expect(await entorno.servicio().contarDisponibles(acotada)).toBe(3);
    const elegidas = await seleccionarTodas(entorno.servicio(), acotada);
    expect(elegidas.map((p) => p.preguntaId)).toEqual(propias.map((p) => p.preguntaId));
    expect(elegidas.map((p) => p.preguntaId)).not.toContain(otras[0]!.preguntaId);
  });
});
