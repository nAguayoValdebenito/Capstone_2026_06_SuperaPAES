import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearWorkerGeneracion } from '../trabajos/worker-generacion.js';

describe('crearWorkerGeneracion', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('procesa la cola en cada intervalo hasta que se detiene', async () => {
    const procesarPendientes = vi.fn(() => Promise.resolve(0));
    const worker = crearWorkerGeneracion({ procesarPendientes }, 1000);

    worker.iniciar();
    await vi.advanceTimersByTimeAsync(3000);
    await worker.detener();
    await vi.advanceTimersByTimeAsync(3000);

    expect(procesarPendientes).toHaveBeenCalledTimes(3);
  });

  it('sigue funcionando si una vuelta falla', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const procesarPendientes = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error('proveedor caído'))
      .mockResolvedValue(1);
    const worker = crearWorkerGeneracion({ procesarPendientes }, 1000);

    worker.iniciar();
    await vi.advanceTimersByTimeAsync(2000);
    await worker.detener();

    expect(procesarPendientes).toHaveBeenCalledTimes(2);
  });
});
