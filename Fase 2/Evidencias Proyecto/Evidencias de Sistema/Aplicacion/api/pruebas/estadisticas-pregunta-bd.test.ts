// Estadísticas por pregunta contra PostgreSQL real (HU-53.1, RF-G13; plan hu-26-calibracion.md, 3.2).
// Cuentan las respuestas corregidas de la versión actual que valen para el progreso: no las de una
// evaluación abierta, ni las omitidas, ni las anuladas. Recalcular de nuevo no cambia nada, y la tarea
// periódica informa cuántas filas cambiaron.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { evaluacionConTiempo, marcar, publicadas } from './evaluaciones-con-tiempo.js';
import { prepararMini } from './mini-ensayo-base.js';

// Valor de prueba, no es un secreto. secretlint-disable-next-line
const CLAVE_TAREAS = 'clave-de-tareas-de-estadisticas-con-32';

exigirBaseEnCi();
describe.skipIf(!urlBase)('estadísticas por pregunta con PostgreSQL (HU-53.1)', () => {
  const m = prepararMini('estadisticas');
  const { base, entorno } = m;

  const servicio = () => entorno.crearServiciosCon({}).evaluaciones;

  /** Responde el ítem con esa letra y ese tiempo, sin corregir (se corrige al cerrar). */
  async function responder(itemId: string, letra: 'A' | 'B', tiempoSeg: number) {
    await marcar(entorno.bd, itemId, letra);
    await entorno.bd.query('UPDATE app.evaluacion_item SET tiempo_seg = $2 WHERE id = $1', [
      itemId,
      tiempoSeg,
    ]);
  }

  const cerrar = (id: string) =>
    entorno.bd.query("SELECT app.cerrar_evaluacion($1, 'entregada')", [id]);

  /** Un mini-ensayo de un estudiante nuevo con esas preguntas; devuelve su id y sus ítems. */
  async function miniEnsayo(correo: string, preguntas: Awaited<ReturnType<typeof publicadas>>) {
    const { id: estudianteId } = await base.sesion(correo);
    const [id = '', ...items] = await evaluacionConTiempo(entorno.bd, {
      estudianteId,
      pruebaId: base.pruebaId,
      tipo: 'mini_ensayo',
      preguntas,
    });
    return { id, items };
  }

  async function filas() {
    const { rows } = await entorno.bd.query<{
      preguntaId: string;
      intentos: number;
      aciertos: number;
      tiempo: number | null;
    }>(
      `SELECT pregunta_id::text AS "preguntaId", intentos, aciertos, tiempo_promedio_seg AS tiempo
         FROM app.estadistica_pregunta ORDER BY pregunta_id`,
    );
    return rows;
  }

  /** p1 respondida bien (40 s) y mal (61 s); p2 mal (30 s); p3 omitida; p1 bien en uno abierto. */
  async function preparar() {
    const [p1, p2, p3] = await publicadas(entorno.bd, 3);
    const primero = await miniEnsayo('ana@ejemplo.cl', [p1!, p2!, p3!]);
    await responder(primero.items[0]!, 'A', 40);
    await responder(primero.items[1]!, 'B', 30);
    await cerrar(primero.id);
    const segundo = await miniEnsayo('beto@ejemplo.cl', [p1!]);
    await responder(segundo.items[0]!, 'B', 61);
    await cerrar(segundo.id);
    const abierto = await miniEnsayo('carla@ejemplo.cl', [p1!]);
    await responder(abierto.items[0]!, 'A', 10);
    return { p1: String(p1!.preguntaId), p2: String(p2!.preguntaId), p3: String(p3!.preguntaId) };
  }

  it('cuenta solo las respuestas corregidas, sin omitidas ni evaluaciones abiertas', async () => {
    const { p1, p2, p3 } = await preparar();

    expect(await servicio().recalcularEstadisticas()).toBe(2);

    expect(await filas()).toEqual([
      { preguntaId: p1, intentos: 2, aciertos: 1, tiempo: 51 },
      { preguntaId: p2, intentos: 1, aciertos: 0, tiempo: 30 },
    ]);
    expect(await servicio().estadisticasDe([p1, p3])).toEqual([
      {
        preguntaId: p1,
        intentos: 2,
        aciertos: 1,
        porcentajeAcierto: 50,
        tiempoPromedioSeg: 51,
        actualizadoEn: expect.any(Date) as Date,
      },
    ]);
  });

  it('volver a recalcular no duplica ni cambia nada', async () => {
    await preparar();
    await servicio().recalcularEstadisticas();
    const antes = await filas();

    expect(await servicio().recalcularEstadisticas()).toBe(0);
    expect(await filas()).toEqual(antes);
  });

  it('una pregunta anulada deja de sumar y queda en cero', async () => {
    const { p1, p2 } = await preparar();
    await servicio().recalcularEstadisticas();
    await entorno.bd.query('SELECT app.anular_pregunta($1)', [p2]);

    expect(await servicio().recalcularEstadisticas()).toBe(1);
    expect(await filas()).toEqual([
      { preguntaId: p1, intentos: 2, aciertos: 1, tiempo: 51 },
      { preguntaId: p2, intentos: 0, aciertos: 0, tiempo: null },
    ]);
    expect(await servicio().estadisticasDe([p2])).toMatchObject([{ porcentajeAcierto: null }]);
  });

  it('la tarea periódica recalcula e informa cuántas cambiaron', async () => {
    await preparar();
    const app = entorno.crearAppCon({ claveTareas: CLAVE_TAREAS });
    const tarea = () =>
      request(app).post('/api/v1/tareas/periodicas').set('Authorization', `Bearer ${CLAVE_TAREAS}`);

    expect((await tarea()).body.data).toMatchObject({ estadisticasActualizadas: 2 });
    expect((await tarea()).body.data).toMatchObject({ estadisticasActualizadas: 0 });
  });
});
