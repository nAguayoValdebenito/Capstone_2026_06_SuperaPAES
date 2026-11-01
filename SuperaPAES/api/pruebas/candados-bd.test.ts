// Candados de sesión (ajuste del generador, decisión 2) contra PostgreSQL real: dos procesos no toman el mismo
// candado a la vez, el segundo no espera, el cliente dedicado se devuelve siempre al pool y el candado se suelta
// aunque el trabajo falle.
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearCandadosDeSesion } from '../db/candados.js';
import { crearPool } from '../db/conexion.js';
import { crearBaseTemporal, exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('candados de sesión con PostgreSQL', () => {
  let base: Awaited<ReturnType<typeof crearBaseTemporal>>;
  let pool: pg.Pool;

  beforeAll(async () => {
    base = await crearBaseTemporal('candados');
    pool = crearPool({ url: base.url, ssl: false });
  }, MINUTO);

  afterAll(async () => {
    await pool.end();
    await base.cerrar();
  }, MINUTO);

  it('mientras uno trabaja, otro proceso no toma el mismo candado ni espera', async () => {
    // Dos «procesos»: cada uno con su propio conjunto de candados sobre el mismo pool.
    const uno = crearCandadosDeSesion(pool);
    const otro = crearCandadosDeSesion(pool);
    let soltar: () => void = () => undefined;
    const pausa = new Promise<void>((resolver) => {
      soltar = resolver;
    });
    let empezo: () => void = () => undefined;
    const arranco = new Promise<void>((resolver) => {
      empezo = resolver;
    });

    const primero = uno.conCandado(7n, async () => {
      empezo();
      await pausa;
      return 'listo';
    });
    await arranco;
    const segundo = await otro.conCandado(7n, () => Promise.resolve('no debería correr'));
    const distinto = await otro.conCandado(8n, () => Promise.resolve('otro lote'));
    soltar();

    expect(segundo).toEqual({ tomado: false });
    expect(distinto).toEqual({ tomado: true, valor: 'otro lote' });
    expect(await primero).toEqual({ tomado: true, valor: 'listo' });
  });

  it('suelta el candado y devuelve el cliente al pool aunque el trabajo falle', async () => {
    const candados = crearCandadosDeSesion(pool);

    await expect(
      candados.conCandado(9n, () => Promise.reject(new Error('el trabajo falló'))),
    ).rejects.toThrow('el trabajo falló');
    const despues = await candados.conCandado(9n, () => Promise.resolve('de nuevo'));

    expect(despues).toEqual({ tomado: true, valor: 'de nuevo' });
    expect(pool.waitingCount).toBe(0);
    const { rows } = await base.bd.query<{ candados: number }>(
      "SELECT COUNT(*)::int AS candados FROM pg_locks WHERE locktype = 'advisory' AND granted",
    );
    // Ningún candado de sesión queda tomado por una conexión del pool.
    expect(rows[0]?.candados).toBe(0);
  });

  it('un candado tomado y liberado muchas veces no agota el pool', async () => {
    const candados = crearCandadosDeSesion(pool);

    for (let i = 0; i < 40; i++) {
      await candados.conCandado(BigInt(100 + i), () => Promise.resolve(i));
    }

    expect(pool.totalCount).toBeLessThanOrEqual(10);
    expect(pool.idleCount).toBe(pool.totalCount);
  });
});
