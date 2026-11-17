import { describe, expect, it } from 'vitest';
import {
  calcularSuma,
  ErrorMigracion,
  esArchivoDeMigracion,
  planificarMigraciones,
  quitarControlDeTransaccion,
} from '../db/migrador.js';

const archivo = (nombre: string, contenido = nombre) => ({
  nombre,
  contenido,
  suma: calcularSuma(contenido),
});

describe('planificarMigraciones', () => {
  it('devuelve en orden las migraciones que aún no se aplican', () => {
    const archivos = [archivo('002_b.sql'), archivo('001_a.sql'), archivo('003_c.sql')];
    const aplicadas = [{ nombre: '001_a.sql', suma: calcularSuma('001_a.sql') }];

    const pendientes = planificarMigraciones(archivos, aplicadas);

    expect(pendientes.map((m) => m.nombre)).toEqual(['002_b.sql', '003_c.sql']);
  });

  it('no devuelve nada si todo está aplicado', () => {
    const archivos = [archivo('001_a.sql')];

    expect(planificarMigraciones(archivos, [archivos[0]!])).toEqual([]);
  });

  it('se detiene si un archivo ya aplicado cambió', () => {
    const archivos = [archivo('001_a.sql', 'contenido nuevo')];
    const aplicadas = [{ nombre: '001_a.sql', suma: calcularSuma('contenido original') }];

    expect(() => planificarMigraciones(archivos, aplicadas)).toThrow(ErrorMigracion);
    expect(() => planificarMigraciones(archivos, aplicadas)).toThrow(/001_a\.sql/);
  });

  it('se detiene si falta en disco una migración ya aplicada', () => {
    const aplicadas = [{ nombre: '001_a.sql', suma: calcularSuma('x') }];

    expect(() => planificarMigraciones([], aplicadas)).toThrow(/001_a\.sql/);
  });

  it('se detiene si dos archivos comparten el mismo número', () => {
    const archivos = [archivo('002_indices.sql'), archivo('002_planes.sql')];

    expect(() => planificarMigraciones(archivos, [])).toThrow(/002/);
  });

  it('se detiene si una migración pendiente es anterior a una ya aplicada', () => {
    const archivos = [archivo('001_a.sql'), archivo('002_tardia.sql'), archivo('003_c.sql')];
    const aplicadas = [archivos[0]!, archivos[2]!];

    expect(() => planificarMigraciones(archivos, aplicadas)).toThrow(/002_tardia\.sql/);
  });
});

describe('esArchivoDeMigracion', () => {
  it.each([
    ['001_esquema_inicial.sql', true],
    ['010_indices.sql', true],
    ['README.md', false],
    ['1_corto.sql', false],
    ['001_sin_extension', false],
  ])('%s → %s', (nombre, esperado) => {
    expect(esArchivoDeMigracion(nombre)).toBe(esperado);
  });
});

describe('calcularSuma', () => {
  it('devuelve el SHA-256 en hexadecimal', () => {
    expect(calcularSuma('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('no cambia con los fines de línea de Windows', () => {
    expect(calcularSuma('SELECT 1;\r\nSELECT 2;\r\n')).toBe(calcularSuma('SELECT 1;\nSELECT 2;\n'));
  });
});

describe('quitarControlDeTransaccion', () => {
  it('quita las líneas BEGIN; y COMMIT; del archivo, también con fines de línea de Windows', () => {
    const sql = 'CREATE TABLE t (id INT);\r\nBEGIN;\r\nINSERT INTO t VALUES (1);\r\ncommit;\r\n';

    expect(quitarControlDeTransaccion(sql)).toBe(
      'CREATE TABLE t (id INT);\r\n\nINSERT INTO t VALUES (1);\r\n\n',
    );
  });

  it('conserva los BEGIN de las funciones PL/pgSQL', () => {
    const funcion = 'CREATE FUNCTION f() RETURNS void AS $$\nBEGIN\n  RETURN;\nEND $$;\n';

    expect(quitarControlDeTransaccion(funcion)).toBe(funcion);
  });
});
