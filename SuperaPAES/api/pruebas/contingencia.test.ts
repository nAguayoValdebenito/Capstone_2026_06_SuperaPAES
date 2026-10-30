// TEC-08: piezas de los scripts de contingencia que no necesitan una base: ocultar secretos en la
// salida, encontrar pg_dump, pg_restore y gpg, exigir una clave larga y nombrar las copias del día.
import { describe, expect, it } from 'vitest';
import { exigirClave, LARGO_MINIMO_CLAVE } from '../db/cifrado.js';
import { encontrarHerramienta, ocultarSecretos, partesSensibles } from '../db/procesos.js';
import { nombresDeCopia } from '../db/copia-de-respaldo.js';

// Dirección inventada para las pruebas, sin ningún servidor real. secretlint-disable-next-line
const URL_FALSA = 'postgres://usuario_falso:clave_falsa_123@ep-falso.example.cl:6543/base_falsa';

describe('ocultar secretos en la salida de los scripts', () => {
  it('oculta la dirección completa, el servidor, el usuario, la contraseña y la base', () => {
    const mensaje =
      'could not translate host name "ep-falso.example.cl"; password authentication failed for user ' +
      '"usuario_falso" (clave_falsa_123) en base_falsa';
    const limpio = ocultarSecretos(mensaje, partesSensibles(URL_FALSA));
    for (const parte of ['ep-falso.example.cl', 'usuario_falso', 'clave_falsa_123', 'base_falsa']) {
      expect(limpio).not.toContain(parte);
    }
    expect(limpio).toContain('[oculto]');
  });

  it('oculta cualquier dirección postgres:// aunque no se haya indicado', () => {
    expect(ocultarSecretos(`conexión a ${URL_FALSA} rechazada`, [])).toBe(
      'conexión a [oculto] rechazada',
    );
  });

  it('una dirección mal escrita se oculta completa', () => {
    expect(partesSensibles('no-es-una-url')).toEqual(['no-es-una-url']);
    expect(partesSensibles(undefined)).toEqual([]);
  });
});

describe('herramientas externas', () => {
  const nunca = () => false;
  it('usa la variable de entorno de la herramienta si existe', () => {
    expect(encontrarHerramienta('pg_dump', { PG_DUMP: '/opt/pg/pg_dump' }, 'linux', nunca)).toBe(
      '/opt/pg/pg_dump',
    );
    expect(encontrarHerramienta('gpg', { GPG: 'C:\\gpg.exe' }, 'win32', nunca)).toBe('C:\\gpg.exe');
  });

  it('en Windows usa la instalación de PostgreSQL 18 y la de Git for Windows', () => {
    const siempre = () => true;
    expect(encontrarHerramienta('pg_restore', {}, 'win32', siempre)).toBe(
      'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe',
    );
    expect(encontrarHerramienta('gpg', {}, 'win32', siempre)).toBe(
      'C:\\Program Files\\Git\\usr\\bin\\gpg.exe',
    );
  });

  it('si no, la busca en el PATH por su nombre', () => {
    expect(encontrarHerramienta('pg_dump', {}, 'linux', nunca)).toBe('pg_dump');
    expect(encontrarHerramienta('gpg', {}, 'win32', nunca)).toBe('gpg');
  });
});

describe('clave del respaldo', () => {
  it(`exige al menos ${LARGO_MINIMO_CLAVE} caracteres`, () => {
    expect(() => exigirClave(undefined)).toThrow('Falta CLAVE_RESPALDO');
    expect(() => exigirClave('a'.repeat(LARGO_MINIMO_CLAVE - 1))).toThrow('al menos 32');
    expect(exigirClave('a'.repeat(LARGO_MINIMO_CLAVE))).toHaveLength(LARGO_MINIMO_CLAVE);
  });

  it('rechaza una clave con salto de línea (gpg leería solo la primera línea)', () => {
    expect(() => exigirClave(`${'a'.repeat(40)}\nb`)).toThrow('salto de línea');
  });
});

describe('nombres de las copias', () => {
  it('llevan la fecha del respaldo y la extensión .gpg', () => {
    expect(nombresDeCopia(new Date('2026-10-30T07:00:00Z'))).toEqual({
      respaldo: 'supera-paes-2026-10-30.dump.gpg',
      cantidades: 'supera-paes-2026-10-30.cantidades.json.gpg',
    });
  });
});
