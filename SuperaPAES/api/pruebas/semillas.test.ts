import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type pg from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorSemilla, ejecutarSemillas } from '../db/semillas.js';

function crearClienteFalso(fallarCon?: string) {
  const consultas: string[] = [];
  const cliente = {
    query: (sql: string) => {
      consultas.push(sql);
      return fallarCon && sql.includes(fallarCon)
        ? Promise.reject(new Error('error SQL'))
        : Promise.resolve({ rows: [] });
    },
  } as unknown as pg.ClientBase;
  return { cliente, consultas };
}

describe('ejecutarSemillas', () => {
  let carpeta: string;
  beforeEach(async () => {
    carpeta = await mkdtemp(path.join(tmpdir(), 'semillas-'));
  });
  afterEach(() => rm(carpeta, { recursive: true, force: true }));

  it('no hace nada si no hay archivos .sql', async () => {
    await writeFile(path.join(carpeta, 'README.md'), '# Semillas');
    const { cliente } = crearClienteFalso();

    expect(await ejecutarSemillas(cliente, carpeta)).toEqual([]);
  });

  it('ejecuta cada archivo en orden y en su propia transacción', async () => {
    await writeFile(path.join(carpeta, '002_b.sql'), 'SELECT 2;');
    await writeFile(path.join(carpeta, '001_a.sql'), 'SELECT 1;');
    const { cliente, consultas } = crearClienteFalso();

    const ejecutadas = await ejecutarSemillas(cliente, carpeta);

    expect(ejecutadas).toEqual(['001_a.sql', '002_b.sql']);
    expect(consultas.filter((c) => !c.includes('advisory'))).toEqual([
      'BEGIN',
      'SELECT 1;',
      'COMMIT',
      'BEGIN',
      'SELECT 2;',
      'COMMIT',
    ]);
  });

  it('revierte la semilla que falla e indica cuál fue', async () => {
    await writeFile(path.join(carpeta, '001_a.sql'), 'SELECT malo;');
    const { cliente, consultas } = crearClienteFalso('malo');

    await expect(ejecutarSemillas(cliente, carpeta)).rejects.toThrow(ErrorSemilla);
    expect(consultas).toContain('ROLLBACK');
    expect(consultas.at(-1)).toContain('pg_advisory_unlock');
  });

  it('registra la falla al liberar el bloqueo sin ocultar el resultado', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await writeFile(path.join(carpeta, '001_a.sql'), 'SELECT 1;');
    const { cliente } = crearClienteFalso('pg_advisory_unlock');

    await expect(ejecutarSemillas(cliente, carpeta)).resolves.toEqual(['001_a.sql']);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('No se pudo liberar el bloqueo'));
  });
});
