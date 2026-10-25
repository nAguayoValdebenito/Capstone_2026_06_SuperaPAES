// Protección de las pruebas con PostgreSQL: solo vacían o borran bases cuyo nombre termina en _test
// (DATABASE_URL_PRUEBAS), nunca la base de desarrollo, aunque la variable esté mal escrita.
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import {
  crearBaseTemporal,
  exigirBaseDePruebas,
  exigirBaseEnCi,
  exigirNombreDePruebas,
  MINUTO,
  nombreDeLaBase,
  urlBase,
  vaciarCuentasInternas,
} from './base-temporal.js';

describe('nombre de la base de pruebas', () => {
  it('acepta solo nombres que terminan en _test, con un mensaje claro', () => {
    expect(() => exigirNombreDePruebas('supera_paes_test')).not.toThrow();
    expect(() => exigirNombreDePruebas('supera_paes')).toThrow(
      /solo vacían o borran bases cuyo nombre termina en _test, y «supera_paes» no[\s\S]*DATABASE_URL_PRUEBAS/,
    );
    expect(() => exigirNombreDePruebas('supera_paes_test_copia')).toThrow(/_test/);
  });

  it('lee el nombre de la base desde la URL', () => {
    // Valor de prueba, no es un secreto. secretlint-disable-next-line
    expect(nombreDeLaBase('postgres://usuario:clave@localhost:5432/supera_paes_test')).toBe(
      'supera_paes_test',
    );
  });

  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('protección con PostgreSQL', () => {
  it('se niega a vaciar una base que no termina en _test, antes de ejecutar el TRUNCATE', async () => {
    const url = new URL(urlBase ?? '');
    url.pathname = '/postgres';
    const otra = new pg.Client({ connectionString: url.toString() });
    await otra.connect();
    try {
      await expect(exigirBaseDePruebas(otra)).rejects.toThrow(/«postgres» no/);
      // Si llegara al TRUNCATE, el error sería que las tablas no existen en la base postgres.
      await expect(vaciarCuentasInternas(otra)).rejects.toThrow(/«postgres» no/);
    } finally {
      await otra.end();
    }
  });

  it(
    'las bases temporales también terminan en _test y sí se pueden vaciar',
    async () => {
      const base = await crearBaseTemporal('proteccion');
      try {
        expect(nombreDeLaBase(base.url)).toMatch(/^supera_paes_proteccion_\d+_test$/);
        await expect(vaciarCuentasInternas(base.bd)).resolves.toBeUndefined();
      } finally {
        await base.cerrar();
      }
    },
    MINUTO,
  );
});
