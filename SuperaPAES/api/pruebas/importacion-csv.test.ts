// Lectura de los CSV de la importación (HU-13.1, RF-G05): coma o punto y coma, comillas, saltos de
// línea dentro de una celda y la marca UTF-8 que agrega Excel.
import { describe, expect, it } from 'vitest';
import { leerCsv, normalizar } from '../modulos/preguntas/preguntas.csv.js';

describe('leerCsv', () => {
  it('separa por punto y coma, como guarda Excel en español, y por coma', () => {
    expect(leerCsv('a;b;c\r\n1;2,5;3\r\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2,5', '3'],
    ]);
    expect(leerCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('respeta las comillas: separadores, saltos de línea y comillas dobladas dentro de la celda', () => {
    expect(leerCsv('a;b\n"x; y";"Dijo ""hola""\ny se fue"\n')).toEqual([
      ['a', 'b'],
      ['x; y', 'Dijo "hola"\ny se fue'],
    ]);
  });

  it('quita la marca UTF-8 de Excel y las filas en blanco del final, pero no las del medio', () => {
    expect(leerCsv('\uFEFFa;b\n1;2\n;\n3;4\n;\n\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['', ''],
      ['3', '4'],
    ]);
  });

  it('mantiene las celdas vacías del final de una fila', () => {
    expect(leerCsv('a;b;c\n1;;\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', ''],
    ]);
  });

  it('sin comillas que cierren, o con texto pegado a la comilla que cierra, no se puede leer', () => {
    expect(leerCsv('a;b\n"abierta;2\n')).toBeNull();
    expect(leerCsv('a;b\n"x"y;2\n')).toBeNull();
  });
});

describe('normalizar', () => {
  it('compara sin tildes, mayúsculas ni espacios de más', () => {
    expect(normalizar('  Competencia   Matemática 1 ')).toBe('competencia matematica 1');
    expect(normalizar('ÁLGEBRA')).toBe(normalizar('algebra'));
  });
});
