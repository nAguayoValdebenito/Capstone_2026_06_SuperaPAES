// Ajustes A y B del generador, contra PostgreSQL real: si el proceso muere a mitad de un lote, el siguiente turno
// continúa con las fichas que faltan sin duplicar ni reiniciar; dos workers no trabajan el mismo lote a la vez
// (candado de sesión); el turno de un lote tiene un plazo máximo; la concurrencia es configurable; y un lote
// pendiente se retoma solo cuando el servicio despierta (el worker corre dentro de la API, que Render duerme).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearWorkerGeneracion } from '../trabajos/worker-generacion.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararGenerador } from './generador-bd.js';
import { resultadoValido } from './ia-falsa.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('reanudación, candado y plazo del lote con PostgreSQL', () => {
  const g = prepararGenerador('reanudacion');
  const { entorno, ia } = g;

  /** La cuenta del administrador se crea una vez por prueba. */
  let sesion: ReturnType<typeof g.sesionAdmin> | undefined;
  beforeEach(() => {
    sesion = undefined;
  });

  async function pedir(cantidad: number, contenidoId = g.contenidos.m1): Promise<number> {
    sesion ??= g.sesionAdmin();
    const respuesta = await g.pedirLote(await sesion, { contenidoId, cantidad });
    expect(respuesta.status).toBe(202);
    return respuesta.body.data.id as number;
  }

  const enunciadosDelLote = async (id: number) =>
    (
      await entorno.bd.query<{ enunciado: string }>(
        'SELECT enunciado FROM contenido.pregunta WHERE lote_id = $1',
        [id],
      )
    ).rows.map((fila) => fila.enunciado);

  describe('si el proceso muere a mitad del lote', () => {
    it('el siguiente turno pide solo las preguntas que faltan, sin duplicar ni reiniciar', async () => {
      const id = await pedir(5);
      // Dos preguntas quedan guardadas y, en la tercera, el proceso muere (error que no es de la IA).
      ia.encolar(
        (s, n) => resultadoValido(s, n),
        (s, n) => resultadoValido(s, n),
        new Error('el proceso murió'),
      );
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const primero = await g.trabajador().procesarPendientes();
      const quedo = await g.filaDeLote(id);

      expect(primero).toBe(0);
      expect(quedo).toMatchObject({ estado: 'pendiente', validas: 2, descartadas: 0 });
      const llamadasAntes = ia.generarPreguntas.mock.calls.length;

      const segundo = await g.trabajador().procesarPendientes();

      expect(segundo).toBe(1);
      expect(ia.generarPreguntas.mock.calls.length - llamadasAntes).toBe(3);
      expect(await g.filaDeLote(id)).toMatchObject({
        estado: 'completado',
        validas: 5,
        descartadas: 0,
      });
      const enunciados = await enunciadosDelLote(id);
      expect(enunciados).toHaveLength(5);
      expect(new Set(enunciados).size).toBe(5);
    });

    it('lo que ya se descartó también cuenta como hecho: no se vuelve a pedir', async () => {
      const id = await pedir(4);
      ia.encolar(
        (s, n) => ({ ...resultadoValido(s, n), preguntas: [] }),
        (s, n) => resultadoValido(s, n),
        new Error('el proceso murió'),
      );
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await g.trabajador().procesarPendientes();
      expect(await g.filaDeLote(id)).toMatchObject({ validas: 1, descartadas: 1 });
      const llamadasAntes = ia.generarPreguntas.mock.calls.length;

      await g.trabajador().procesarPendientes();

      expect(ia.generarPreguntas.mock.calls.length - llamadasAntes).toBe(2);
      expect(await g.filaDeLote(id)).toMatchObject({
        estado: 'completado',
        validas: 3,
        descartadas: 1,
      });
    });
  });

  describe('candado de sesión: dos workers sobre el mismo lote', () => {
    it('el segundo no trabaja el lote mientras el primero lo tiene, y no se pide ninguna pregunta de más', async () => {
      const id = await pedir(2);
      let abrir: () => void = () => undefined;
      const compuerta = new Promise<void>((resolver) => {
        abrir = resolver;
      });
      // La primera llamada espera: el primer worker queda dentro del lote con el candado tomado.
      ia.generarPreguntas.mockImplementationOnce(async (solicitud) => {
        ia.llamadas.push(solicitud);
        await compuerta;
        return resultadoValido(solicitud, 100);
      });

      const primero = g.trabajador().procesarPendientes();
      await vi.waitFor(() => expect(ia.generarPreguntas).toHaveBeenCalledTimes(1));
      const segundo = await g.trabajador().procesarPendientes();
      expect(ia.generarPreguntas).toHaveBeenCalledTimes(1);
      abrir();

      expect(segundo).toBe(0);
      expect(await primero).toBe(1);
      expect(ia.generarPreguntas).toHaveBeenCalledTimes(2);
      expect(await g.filaDeLote(id)).toMatchObject({
        estado: 'completado',
        validas: 2,
        descartadas: 0,
      });
      expect(await enunciadosDelLote(id)).toHaveLength(2);
    });

    it('al terminar el primero suelta el candado: un lote nuevo lo toma sin esperar', async () => {
      await pedir(1);
      await g.trabajador().procesarPendientes();
      await pedir(2, g.contenidos.m2);

      const procesados = await g.trabajador().procesarPendientes();

      expect(procesados).toBe(1);
    });
  });

  it('procesa todos los lotes pendientes en un mismo turno, los más antiguos primero', async () => {
    const primero = await pedir(1);
    const segundo = await pedir(1, g.contenidos.m2);

    const procesados = await g.trabajador().procesarPendientes();

    expect(procesados).toBe(2);
    expect(await g.filaDeLote(primero)).toMatchObject({ estado: 'completado' });
    expect(await g.filaDeLote(segundo)).toMatchObject({ estado: 'completado' });
  });

  describe('plazo máximo del turno', () => {
    it('al vencer cierra el lote con lo que tenga, como completado si hay válidas', async () => {
      const id = await pedir(5);
      ia.encolar(
        (s, n) => resultadoValido(s, n),
        (s, n) => {
          entorno.avanzarSegundos(21 * 60);
          return resultadoValido(s, n);
        },
      );

      await g.trabajador().procesarPendientes();

      expect(ia.generarPreguntas).toHaveBeenCalledTimes(2);
      const fila = await g.filaDeLote(id);
      expect(fila).toMatchObject({ estado: 'completado', validas: 2 });
      expect(fila['motivos_descarte']).toMatchObject({ cierre: 'plazo' });
    });

    it('el plazo es de cada turno: tras una caída, el lote tiene plazo nuevo', async () => {
      const id = await pedir(3);
      ia.encolar((s, n) => resultadoValido(s, n), new Error('murió'));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await g.trabajador().procesarPendientes();
      entorno.avanzarSegundos(60 * 60);

      await g.trabajador().procesarPendientes();

      expect(await g.filaDeLote(id)).toMatchObject({ estado: 'completado', validas: 3 });
    });
  });

  describe('concurrencia configurable (concurrencia_ia)', () => {
    it('con 3 pide hasta 3 preguntas a la vez y guarda las 6', async () => {
      const id = await pedir(6);
      await g.parametro('concurrencia_ia', 3);
      let enVuelo = 0;
      let maximo = 0;
      let numero = 200;
      for (let i = 0; i < 6; i++) {
        ia.generarPreguntas.mockImplementationOnce(async (solicitud) => {
          ia.llamadas.push(solicitud);
          enVuelo += 1;
          maximo = Math.max(maximo, enVuelo);
          await new Promise((resolver) => setTimeout(resolver, 25));
          enVuelo -= 1;
          numero += 1;
          return resultadoValido(solicitud, numero);
        });
      }

      await g.trabajador().procesarPendientes();

      expect(maximo).toBe(3);
      expect(await g.filaDeLote(id)).toMatchObject({ estado: 'completado', validas: 6 });
      expect(new Set(await enunciadosDelLote(id)).size).toBe(6);
    });

    it('por defecto es una a la vez', async () => {
      await pedir(3);
      let enVuelo = 0;
      let maximo = 0;
      for (let i = 0; i < 3; i++) {
        ia.generarPreguntas.mockImplementationOnce(async (solicitud) => {
          ia.llamadas.push(solicitud);
          enVuelo += 1;
          maximo = Math.max(maximo, enVuelo);
          await new Promise((resolver) => setTimeout(resolver, 10));
          enVuelo -= 1;
          return resultadoValido(solicitud, 300 + i);
        });
      }

      await g.trabajador().procesarPendientes();

      expect(maximo).toBe(1);
    });

    it('un valor fuera de rango se acota: nunca más de 5 a la vez', async () => {
      await pedir(10);
      await g.parametro('concurrencia_ia', 50);
      let enVuelo = 0;
      let maximo = 0;
      for (let i = 0; i < 10; i++) {
        ia.generarPreguntas.mockImplementationOnce(async (solicitud) => {
          ia.llamadas.push(solicitud);
          enVuelo += 1;
          maximo = Math.max(maximo, enVuelo);
          await new Promise((resolver) => setTimeout(resolver, 10));
          enVuelo -= 1;
          return resultadoValido(solicitud, 400 + i);
        });
      }

      await g.trabajador().procesarPendientes();

      expect(maximo).toBe(5);
    });
  });

  describe('retome al despertar (el worker corre dentro de la API)', () => {
    it('un lote pendiente se procesa solo cuando el worker despierta, sin ninguna petición', async () => {
      const id = await pedir(3);
      expect(await g.filaDeLote(id)).toMatchObject({ estado: 'pendiente' });
      const worker = crearWorkerGeneracion(g.trabajador(), 20);

      worker.iniciar();
      await vi.waitFor(
        async () => {
          expect(await g.filaDeLote(id)).toMatchObject({ estado: 'completado', validas: 3 });
        },
        { timeout: 10_000, interval: 25 },
      );
      await worker.detener();
    });
  });
});
