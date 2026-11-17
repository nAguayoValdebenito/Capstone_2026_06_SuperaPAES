// Migración 005 (HU-16.2): parámetros de la IA por proveedor. Solo INSERT ... ON CONFLICT DO NOTHING: una
// instalación nueva los recibe, y una que ya los tenga (cambiados por un administrador) no se toca.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearBaseTemporal, exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';

const archivo = path.join(import.meta.dirname, '../db/migraciones/005_parametros_ia.sql');

const ESPERADOS: Record<string, number> = {
  temperatura_ia_deepseek: 0.7,
  temperatura_ia_gemini: 0.7,
  precio_entrada_ia_deepseek: 0.3,
  precio_salida_ia_deepseek: 1.2,
  precio_entrada_ia_gemini: 0.54,
  precio_salida_ia_gemini: 4.5,
  concurrencia_ia: 1,
};

describe('migración de los parámetros de IA sin base', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('migración de los parámetros de IA con PostgreSQL', () => {
  let base: Awaited<ReturnType<typeof crearBaseTemporal>>;
  beforeAll(async () => {
    base = await crearBaseTemporal('parametros_ia');
  }, MINUTO);
  afterAll(async () => {
    await base.cerrar();
  }, MINUTO);

  const leer = async () => {
    const { rows } = await base.bd.query<{ clave: string; valor: unknown; descripcion: string }>(
      'SELECT clave, valor, descripcion FROM contenido.configuracion WHERE clave = ANY($1)',
      [Object.keys(ESPERADOS)],
    );
    return Object.fromEntries(rows.map((fila) => [fila.clave, fila]));
  };

  it('una instalación nueva trae los siete parámetros con sus valores y una descripción', async () => {
    const parametros = await leer();

    expect(Object.keys(parametros).sort()).toEqual(Object.keys(ESPERADOS).sort());
    for (const [clave, valor] of Object.entries(ESPERADOS)) {
      expect(parametros[clave]?.valor, clave).toBe(valor);
      expect(parametros[clave]?.descripcion.length, clave).toBeGreaterThan(20);
    }
  });

  it('repetirla no cambia nada ni pisa un valor que un administrador ya cambió', async () => {
    await base.bd.query(
      "UPDATE contenido.configuracion SET valor = '0.2'::jsonb WHERE clave = 'temperatura_ia_gemini'",
    );
    const antes = await base.bd.query('SELECT * FROM contenido.configuracion ORDER BY clave');

    await base.bd.query(await readFile(archivo, 'utf8'));

    const despues = await base.bd.query('SELECT * FROM contenido.configuracion ORDER BY clave');
    expect(despues.rows).toEqual(antes.rows);
    expect((await leer())['temperatura_ia_gemini']?.valor).toBe(0.2);
  });

  it('no toca el tope mensual de US$ 10 (RNF-03) ni el resto de los parámetros', async () => {
    const { rows } = await base.bd.query<{ valor: unknown }>(
      "SELECT valor FROM contenido.configuracion WHERE clave = 'tope_mensual_ia_usd'",
    );
    expect(rows[0]?.valor).toBe(10);
  });
});
