// A-15 y DAS 4.3.3, contra PostgreSQL real: el mensaje de un error de la base puede traer texto de las filas,
// como el de un lote de la IA. Si falla una vuelta del worker, el registro guarda solo la clase y el código.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { crearWorkerGeneracion } from '../trabajos/worker-generacion.js';
import {
  crearBaseTemporal,
  exigirBaseEnCi,
  MINUTO,
  urlBase,
  type BaseTemporal,
} from './base-temporal.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('registro del worker de generación con PostgreSQL (A-15)', () => {
  let base: BaseTemporal;
  beforeAll(async () => {
    base = await crearBaseTemporal('worker_registro');
  }, MINUTO);
  afterAll(async () => {
    await base.cerrar();
  }, MINUTO);

  it('si falla una vuelta, el registro no guarda el mensaje del error de la base', async () => {
    const texto = 'enunciado que devolvió la IA';
    const falla = await base.bd.query('SELECT $1::int', [texto]).catch((e: unknown) => e);
    expect(String(falla)).toContain(texto);
    const salida = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const procesarPendientes = vi.fn(() => Promise.reject(falla as Error));
    const worker = crearWorkerGeneracion({ procesarPendientes }, 1);

    worker.iniciar();
    await vi.waitFor(() => {
      expect(procesarPendientes).toHaveBeenCalled();
    });
    await worker.detener();

    const registrado = String(salida.mock.calls[0]?.[0]);
    salida.mockRestore();
    expect(registrado).toContain('Falló el worker de generación');
    expect(registrado).toContain('error:22P02');
    expect(registrado).not.toContain(texto);
  });
});
