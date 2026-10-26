// Regresiones de revisión: evaluar textos completos y el prefijo que realmente se entregará.
import { describe, expect, it } from 'vitest';
import type { CodigoDificultad } from '../modulos/evaluaciones/evaluaciones.seleccion.tipos.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { AHORA_SELECCION, prepararSeleccion, seleccionarTodas } from './base-seleccion.js';
import { crearPreguntaPublicada, crearTextoDePrueba } from './preguntas-de-prueba.js';
import { registrarRespuestaDePrueba } from './historial-seleccion.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('Lectora: composición de los bloques completos', () => {
  const entorno = prepararSeleccion('seleccion_composicion');
  async function texto(
    dificultades: readonly CodigoDificultad[],
    habilidades: readonly number[] = [],
  ) {
    const textoId = await crearTextoDePrueba(entorno.bd);
    const preguntas = [];
    for (const [i, dificultad] of dificultades.entries()) {
      const habilidadId = habilidades[i];
      preguntas.push(
        await crearPreguntaPublicada(entorno.bd, {
          prueba: 'CL',
          textoId,
          ordenEnTexto: i + 1,
          dificultad,
          ...(habilidadId !== undefined && { habilidadId }),
        }),
      );
    }
    return preguntas;
  }

  it('elige el texto que cumple 2/2/1 frente a otro que solo contiene alguna pregunta media', async () => {
    await texto(['facil', 'facil', 'facil', 'facil', 'media']);
    const equilibrado = await texto(['facil', 'media', 'dificil', 'facil', 'media']);
    const datos = await entorno.datos('CL', 5);
    expect((await seleccionarTodas(entorno.servicio(), datos)).map((p) => p.preguntaId)).toEqual(
      equilibrado.map((p) => p.preguntaId),
    );
  });

  it('compara el prefijo al cortar el último texto, no su composición después del corte', async () => {
    await texto(['facil', 'facil', 'facil', 'media', 'dificil']);
    const equilibrado = await texto(['facil', 'media', 'dificil', 'facil', 'facil']);
    const datos = await entorno.datos('CL', 3);
    expect((await seleccionarTodas(entorno.servicio(), datos)).map((p) => p.preguntaId)).toEqual(
      equilibrado.slice(0, 3).map((p) => p.preguntaId),
    );
  });

  it('elige un texto mixto con cinco preguntas débiles frente a otro con solo una', async () => {
    const datos = { ...(await entorno.datos('CL', 10)), dificultad: 'media' as const };
    const { rows: habilidades } = await entorno.bd.query<{ id: number }>(
      'SELECT id FROM contenido.habilidad WHERE prueba_id=$1 ORDER BY id',
      [datos.pruebaId],
    );
    const debil = habilidades[0]!.id;
    const fuerte = habilidades[1]!.id;
    const medias: CodigoDificultad[] = Array.from({ length: 10 }, () => 'media');
    await texto(medias, [...Array<number>(9).fill(fuerte), debil]);
    const equilibrado = await texto(medias, [
      ...Array<number>(5).fill(fuerte),
      ...Array<number>(5).fill(debil),
    ]);
    const historial = await texto(medias.slice(0, 5), Array<number>(5).fill(debil));
    for (const pregunta of historial) {
      await registrarRespuestaDePrueba(entorno.bd, datos, {
        pregunta,
        acertada: false,
        fecha: new Date(AHORA_SELECCION.getTime() - 86_400_000),
      });
      await entorno.bd.query(
        `UPDATE contenido.pregunta SET estado_pregunta_id=(SELECT id FROM contenido.estado_pregunta WHERE codigo='retirada') WHERE id=$1`,
        [pregunta.preguntaId],
      );
    }
    expect((await seleccionarTodas(entorno.servicio(), datos)).map((p) => p.preguntaId)).toEqual(
      equilibrado.map((p) => p.preguntaId),
    );
  });
});
