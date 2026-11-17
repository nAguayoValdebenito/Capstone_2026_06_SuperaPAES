import { describe, expect, it } from 'vitest';
import {
  adaptarScript,
  casoCorrecto,
  encontrarPsql,
  entornoPsql,
  leerResultados,
  resumirPorGrupo,
  SEPARADOR,
} from '../db/prueba-modelo.js';

const fila = (...columnas: string[]) => columnas.join(SEPARADOR);

describe('adaptarScript', () => {
  const script = '\\set ON_ERROR_STOP 1\n\\o /dev/null\nSELECT 1;\n\\o\n\\o /tmp/resultado.txt\n';

  it('en Windows cambia /dev/null por NUL y la salida a archivo por la ruta pedida', () => {
    expect(adaptarScript(script, 'win32', 'C:\\Temp\\r.txt')).toBe(
      "\\set ON_ERROR_STOP 1\n\\o NUL\nSELECT 1;\n\\o\n\\o 'C:/Temp/r.txt'\n",
    );
  });

  it('en Linux conserva /dev/null', () => {
    expect(adaptarScript(script, 'linux', '/tmp/x/r.txt')).toContain('\\o /dev/null\n');
  });
});

describe('leerResultados', () => {
  it('lee cada caso y une un motivo que continúa en otra línea', () => {
    const texto = [
      fila('1', 'Grupo', 'Caso uno', 'rechazo', 'rechazado', 'violación'),
      'de la restricción',
      fila('2', 'Grupo', 'Caso dos', 'aceptado', 'aceptado', ''),
      '',
    ].join('\n');

    expect(leerResultados(texto)).toEqual([
      {
        numero: 1,
        grupo: 'Grupo',
        caso: 'Caso uno',
        esperado: 'rechazo',
        obtenido: 'rechazado',
        motivo: 'violación de la restricción',
      },
      {
        numero: 2,
        grupo: 'Grupo',
        caso: 'Caso dos',
        esperado: 'aceptado',
        obtenido: 'aceptado',
        motivo: '',
      },
    ]);
  });
});

describe('casoCorrecto y resumirPorGrupo', () => {
  const caso = (grupo: string, esperado: string, obtenido: string) => ({
    numero: 1,
    grupo,
    caso: 'c',
    esperado,
    obtenido,
    motivo: '',
  });

  it.each([
    ['rechazo', 'rechazado', true],
    ['rechazo', 'ACEPTADO', false],
    ['aceptado', 'RECHAZADO', false],
    ['1M', '1M', true],
    ['1M', 'DISTINTO: 2M', false],
  ])('esperado %s y obtenido %s → %s', (esperado, obtenido, correcto) => {
    expect(casoCorrecto(caso('g', esperado, obtenido))).toBe(correcto);
  });

  it('cuenta correctos y total por grupo, en orden de aparición', () => {
    const casos = [caso('B', 'x', 'x'), caso('A', 'x', 'y'), caso('B', 'rechazo', 'ACEPTADO')];

    expect(resumirPorGrupo(casos)).toEqual([
      { grupo: 'B', correctos: 1, total: 2 },
      { grupo: 'A', correctos: 0, total: 1 },
    ]);
  });
});

describe('encontrarPsql', () => {
  it('usa la variable PSQL si está definida', () => {
    expect(encontrarPsql({ PSQL: '/opt/psql' }, 'win32', () => true)).toBe('/opt/psql');
  });

  it('en Windows usa la instalación de PostgreSQL 18 si existe', () => {
    expect(encontrarPsql({}, 'win32', () => true)).toContain('PostgreSQL\\18\\bin\\psql.exe');
  });

  it('si no, usa psql del PATH', () => {
    expect(encontrarPsql({}, 'linux', () => true)).toBe('psql');
  });
});

describe('entornoPsql', () => {
  it('pasa la conexión en variables de libpq y no como argumento', () => {
    // secretlint-disable-next-line
    const entorno = entornoPsql('postgres://ana:cl%40ve@db.local:6543/base_prueba', true);

    expect(entorno).toMatchObject({
      PGHOST: 'db.local',
      PGPORT: '6543',
      PGUSER: 'ana',
      PGPASSWORD: 'cl@ve',
      PGDATABASE: 'base_prueba',
      PGSSLMODE: 'verify-full',
    });
  });
});
