// Unidad de trabajo: un error a mitad de la operación revierte todo.
import pg from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { crearUnidadDeTrabajo, type Ejecutor } from '../db/transaccion.js';
import { exigirBaseDePruebas, urlBase } from './base-temporal.js';

/** Cliente falso que registra cada consulta. */
function crearPoolFalso(fallarCon?: string) {
  const consultas: string[] = [];
  let liberado = false;
  const cliente = {
    query: (sql: string) => {
      consultas.push(sql);
      return sql === fallarCon
        ? Promise.reject(new Error('conexión caída'))
        : Promise.resolve({ rows: [] });
    },
    release: () => {
      liberado = true;
    },
  } as unknown as Ejecutor & { release(): void };
  return {
    pool: { connect: () => Promise.resolve(cliente) },
    consultas,
    fueLiberado: () => liberado,
  };
}

describe('crearUnidadDeTrabajo', () => {
  it('confirma (COMMIT) cuando todo el trabajo termina bien', async () => {
    const { pool, consultas, fueLiberado } = crearPoolFalso();

    const resultado = await crearUnidadDeTrabajo(pool).enTransaccion(async (tx) => {
      await tx.query('INSERT INTO app.evaluacion_item ...');
      await tx.query('UPDATE app.cupo_diario ...');
      return 'listo';
    });

    expect(resultado).toBe('listo');
    expect(consultas).toEqual([
      'BEGIN',
      'INSERT INTO app.evaluacion_item ...',
      'UPDATE app.cupo_diario ...',
      'COMMIT',
    ]);
    expect(fueLiberado()).toBe(true);
  });

  it('revierte (ROLLBACK) todo si falla a mitad de la operación y propaga el error', async () => {
    const { pool, consultas, fueLiberado } = crearPoolFalso();
    const falla = new Error('sin cupo');

    await expect(
      crearUnidadDeTrabajo(pool).enTransaccion(async (tx) => {
        await tx.query('INSERT INTO app.evaluacion_item ...');
        throw falla;
      }),
    ).rejects.toBe(falla);

    expect(consultas).toEqual(['BEGIN', 'INSERT INTO app.evaluacion_item ...', 'ROLLBACK']);
    expect(consultas).not.toContain('COMMIT');
    expect(fueLiberado()).toBe(true);
  });
});

describe('ROLLBACK que también falla', () => {
  it('registra la falla secundaria y propaga el error original', async () => {
    const registrado = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { pool } = crearPoolFalso('ROLLBACK');
    const falla = new Error('sin cupo');

    await expect(
      crearUnidadDeTrabajo(pool).enTransaccion(() => Promise.reject(falla)),
    ).rejects.toBe(falla);
    expect(registrado).toHaveBeenCalledWith(expect.stringContaining('Falló el ROLLBACK'));
  });
});

// Con PostgreSQL real: se activa con DATABASE_URL_PRUEBAS (una base aparte terminada en _test, en la
// CI o en api/.env), nunca con la base de desarrollo.
describe.skipIf(!urlBase)('crearUnidadDeTrabajo con PostgreSQL', () => {
  const pool = new pg.Pool({ connectionString: urlBase, max: 2 });
  afterAll(() => pool.end());

  it('no deja rastro de lo escrito antes del error', async () => {
    await exigirBaseDePruebas(pool);
    const tabla = `prueba_unidad_${process.pid}`;
    await pool.query(`CREATE TABLE ${tabla} (n INTEGER)`);
    try {
      await expect(
        crearUnidadDeTrabajo(pool).enTransaccion(async (tx) => {
          await tx.query(`INSERT INTO ${tabla} VALUES (1), (2)`);
          throw new Error('falla a mitad de la operación');
        }),
      ).rejects.toThrow('falla a mitad');

      const { rows } = await pool.query<{ total: string }>(
        `SELECT count(*) AS total FROM ${tabla}`,
      );
      expect(rows[0]?.total).toBe('0');
    } finally {
      await pool.query(`DROP TABLE ${tabla}`);
    }
  });
});
