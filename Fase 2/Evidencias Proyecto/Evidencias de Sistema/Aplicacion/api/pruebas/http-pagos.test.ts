// Cliente HTTP de las pasarelas de pago (HU-43.1) contra un servidor local: tiempo límite y respuesta.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { clienteHttpFetch } from '../adaptadores/pagos/http.js';

describe('clienteHttpFetch', () => {
  it('corta la petición que tarda más que el tiempo límite', async () => {
    const servidor = createServer(() => undefined);
    await new Promise<void>((listo) => servidor.listen(0, '127.0.0.1', listo));
    const { port } = servidor.address() as AddressInfo;
    try {
      await expect(
        clienteHttpFetch({
          metodo: 'GET',
          url: `http://127.0.0.1:${String(port)}/`,
          tiempoLimiteMs: 50,
        }),
      ).rejects.toThrow();
    } finally {
      servidor.closeAllConnections();
      servidor.close();
    }
  });

  it('entrega el estado y el cuerpo como texto', async () => {
    const servidor = createServer((_req, res) => {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end('{"error":"no"}');
    });
    await new Promise<void>((listo) => servidor.listen(0, '127.0.0.1', listo));
    const { port } = servidor.address() as AddressInfo;
    try {
      expect(
        await clienteHttpFetch({ metodo: 'GET', url: `http://127.0.0.1:${String(port)}/` }),
      ).toEqual({ estado: 404, cuerpo: '{"error":"no"}' });
    } finally {
      servidor.close();
    }
  });
});
