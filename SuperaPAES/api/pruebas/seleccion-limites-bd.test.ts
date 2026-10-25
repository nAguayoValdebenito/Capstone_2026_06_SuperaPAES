import { describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararSeleccion, seleccionarTodas } from './base-seleccion.js';
import { crearPracticaDePrueba, insertarEntregaDePrueba } from './historial-seleccion.js';
import {
  crearPreguntaPublicada,
  crearTextoDePrueba,
  publicarPreguntaDePrueba,
} from './preguntas-de-prueba.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('selección: límites del contrato y versión vigente', () => {
  const entorno = prepararSeleccion('seleccion_limites');

  it('el eje seleccionado coincide con la versión publicada aunque el temario cambie de eje', async () => {
    const pregunta = await crearPreguntaPublicada(entorno.bd, {
      prueba: 'M1',
      dificultad: 'media',
    });
    const datos = await entorno.datos('M1', 5);
    const {
      rows: [otro],
    } = await entorno.bd.query<{ id: number }>(
      'SELECT id FROM contenido.eje_tematico WHERE prueba_id=$1 AND id<>$2 ORDER BY id LIMIT 1',
      [datos.pruebaId, pregunta.ejeId],
    );
    await entorno.bd.query('UPDATE contenido.contenido_tematico SET eje_id=$2 WHERE id=$1', [
      pregunta.contenidoId,
      otro!.id,
    ]);
    expect(await entorno.servicio().contarDisponibles({ ...datos, ejeId: otro!.id })).toBe(0);
    const acotada = { ...datos, ejeId: pregunta.ejeId };
    expect(await entorno.servicio().contarDisponibles(acotada)).toBe(1);
    const elegida = await entorno.servicio().elegirSiguiente(acotada);
    expect(elegida).toEqual({ preguntaId: pregunta.preguntaId, version: pregunta.version });
    const evaluacion = await crearPracticaDePrueba(entorno.bd, acotada);
    await expect(
      insertarEntregaDePrueba(entorno.bd, evaluacion, elegida!, 1),
    ).resolves.toBeTruthy();
  });

  it('un alcance sin preguntas devuelve cero y null sin excepción', async () => {
    const datos = await entorno.datos();
    expect(await entorno.servicio().contarDisponibles(datos)).toBe(0);
    expect(await entorno.servicio().elegirSiguiente(datos)).toBeNull();
  });

  it('un curso explícito inexistente no permite acceder a todos los contenidos', async () => {
    await crearPreguntaPublicada(entorno.bd, { prueba: 'M1', dificultad: 'media' });
    const datos = { ...(await entorno.datos()), nivelEscolarId: -1 };
    expect(await entorno.servicio().contarDisponibles(datos)).toBe(0);
    expect(await entorno.servicio().elegirSiguiente(datos)).toBeNull();
  });

  it('solo entrega la versión vigente y excluye la pregunta aunque se entregara una versión anterior', async () => {
    const pregunta = await crearPreguntaPublicada(entorno.bd, {
      prueba: 'M1',
      dificultad: 'media',
    });
    for (const estado of ['retirada', 'borrador']) {
      await entorno.bd.query(
        `UPDATE contenido.pregunta SET estado_pregunta_id=(SELECT id FROM contenido.estado_pregunta WHERE codigo=$2) WHERE id=$1`,
        [pregunta.preguntaId, estado],
      );
    }
    await entorno.bd.query(`UPDATE contenido.pregunta SET enunciado='Versión nueva' WHERE id=$1`, [
      pregunta.preguntaId,
    ]);
    await publicarPreguntaDePrueba(entorno.bd, pregunta.preguntaId, 'facil');
    const datos = await entorno.datos();
    expect(await entorno.servicio().elegirSiguiente(datos)).toEqual({
      preguntaId: pregunta.preguntaId,
      version: pregunta.version + 1,
    });
    expect(
      await entorno.servicio().elegirSiguiente({ ...datos, entregadas: [pregunta] }),
    ).toBeNull();
  });

  it('CP-19 paso 6: con 20 difíciles disponibles, las 20 elegidas son difíciles', async () => {
    for (let i = 0; i < 20; i++)
      await crearPreguntaPublicada(entorno.bd, { prueba: 'M1', dificultad: 'dificil' });
    const facil = await crearPreguntaPublicada(entorno.bd, { prueba: 'M1', dificultad: 'facil' });
    const datos = { ...(await entorno.datos()), dificultad: 'dificil' as const };
    const elegidas = await seleccionarTodas(entorno.servicio(), datos);
    expect(elegidas).toHaveLength(20);
    expect(elegidas.map((p) => p.preguntaId)).not.toContain(facil.preguntaId);
  });

  it('Lectora no depende del curso aunque un contenido tenga nivel asignado', async () => {
    const textoId = await crearTextoDePrueba(entorno.bd);
    const pregunta = await crearPreguntaPublicada(entorno.bd, {
      prueba: 'CL',
      dificultad: 'media',
      textoId,
      ordenEnTexto: 1,
    });
    await entorno.bd.query(
      `UPDATE contenido.contenido_tematico SET nivel_escolar_id=(SELECT id FROM contenido.nivel_escolar WHERE codigo='4M') WHERE id=$1`,
      [pregunta.contenidoId],
    );
    expect(await entorno.servicio().contarDisponibles(await entorno.datos('CL'))).toBe(1);
  });

  it('usa el curso calculado por app.nivel_escolar_en en la fecha inicial y no el de hoy', async () => {
    const pregunta = await crearPreguntaPublicada(entorno.bd, {
      prueba: 'M1',
      dificultad: 'media',
    });
    await entorno.bd.query(
      `UPDATE contenido.contenido_tematico SET nivel_escolar_id=(SELECT id FROM contenido.nivel_escolar WHERE codigo='3M') WHERE id=$1`,
      [pregunta.contenidoId],
    );
    const datos = await entorno.datos();
    expect(await entorno.servicio().contarDisponibles(datos)).toBe(0);
    expect(
      await entorno
        .servicio()
        .contarDisponibles({ ...datos, iniciadaEn: new Date('2027-03-01T15:00:00Z') }),
    ).toBe(1);
  });
});
