// Base temporal de PostgreSQL para las pruebas que necesitan la base real (crear-admin, continuidad del
// administrador, sesiones, verificación del correo). Se crea con las migraciones y se borra al terminar.
// Se activa con DATABASE_URL_PRUEBAS, que apunta a una base aparte cuyo nombre termina en _test (por
// ejemplo supera_paes_test), nunca a la de desarrollo; en la CI siempre está, y si falta, la prueba
// `exigirBaseEnCi` falla en vez de omitirse en silencio.
// Protección: ningún ayudante vacía ni borra una base cuyo nombre no termine en _test.
import path from 'node:path';
import pg from 'pg';
import { expect, it } from 'vitest';
import { migrar } from '../db/migrador.js';

export const urlBase = process.env['DATABASE_URL_PRUEBAS'];
export const MINUTO = 60_000;

const SUFIJO_PRUEBAS = '_test';

/**
 * Se niega a seguir si la base no es de pruebas: así ningún TRUNCATE ni DROP de las pruebas llega a la
 * base de desarrollo, aunque DATABASE_URL_PRUEBAS esté mal escrita.
 */
export function exigirNombreDePruebas(nombre: string): void {
  if (!nombre.endsWith(SUFIJO_PRUEBAS)) {
    throw new Error(
      `Las pruebas solo vacían o borran bases cuyo nombre termina en ${SUFIJO_PRUEBAS}, y «${nombre}» no. ` +
        'Revisa DATABASE_URL_PRUEBAS en api/.env: debe apuntar a una base aparte, por ejemplo supera_paes_test.',
    );
  }
}

/** Comprueba en la propia conexión que la base actual es de pruebas, antes de vaciar tablas. */
export async function exigirBaseDePruebas(bd: pg.ClientBase | pg.Pool): Promise<void> {
  const { rows } = await bd.query<{ nombre: string }>('SELECT current_database() AS nombre');
  exigirNombreDePruebas(rows[0]?.nombre ?? '');
}

/** Nombre de la base de una URL de PostgreSQL (la parte después de la última /). */
export function nombreDeLaBase(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
}

/** En la CI, las pruebas con PostgreSQL no se pueden omitir. */
export function exigirBaseEnCi(): void {
  it.runIf(Boolean(process.env['CI']))(
    'la CI define DATABASE_URL_PRUEBAS, así que las pruebas con PostgreSQL no se omiten',
    () => {
      expect(urlBase).toBeTruthy();
    },
  );
}

export interface BaseTemporal {
  /** URL de la base temporal, por ejemplo para crear un pool como el de la API. */
  url: string;
  /** Conexión principal, ya migrada. */
  bd: pg.Client;
  /** Otra conexión a la misma base, por ejemplo para dos operaciones al mismo tiempo. */
  conectarOtra(): Promise<pg.Client>;
  cerrar(): Promise<void>;
}

export async function crearBaseTemporal(prefijo: string): Promise<BaseTemporal> {
  exigirNombreDePruebas(nombreDeLaBase(urlBase ?? ''));
  // Nombre generado aquí (solo letras, números y _): se puede escribir en el SQL. Termina en _test.
  const nombre = `supera_paes_${prefijo}_${Date.now()}${SUFIJO_PRUEBAS}`;
  const admin = new pg.Client({ connectionString: urlBase });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${nombre}`);
  const url = new URL(urlBase ?? '');
  url.pathname = `/${nombre}`;
  const conectarOtra = async () => {
    const cliente = new pg.Client({ connectionString: url.toString() });
    await cliente.connect();
    return cliente;
  };
  const bd = await conectarOtra();
  await migrar(bd, path.join(import.meta.dirname, '../db/migraciones'));
  return {
    url: url.toString(),
    bd,
    conectarOtra,
    async cerrar() {
      await bd.end();
      exigirNombreDePruebas(nombre);
      await admin.query(`DROP DATABASE IF EXISTS ${nombre} WITH (FORCE)`);
      await admin.end();
    },
  };
}

/** Vacía las tablas indicadas (TRUNCATE ... CASCADE), solo en una base de pruebas. */
export async function vaciarTablas(bd: pg.Client, tablas: readonly string[]): Promise<void> {
  await exigirBaseDePruebas(bd);
  await bd.query(`TRUNCATE ${tablas.join(', ')} CASCADE`);
}

/**
 * La auditoría no admite DELETE (disparador): TRUNCATE no lo dispara y deja las tablas vacías. El
 * CASCADE también vacía las tablas que apuntan a usuario_interno, entre ellas contenido.configuracion
 * (por actualizado_por): sus parámetros, que carga la migración, se guardan y se vuelven a cargar.
 */
export async function vaciarCuentasInternas(bd: pg.Client): Promise<void> {
  await exigirBaseDePruebas(bd);
  const { rows } = await bd.query<{ filas: unknown }>(
    `SELECT COALESCE(json_agg(c), '[]') AS filas
       FROM (SELECT clave, valor, descripcion, actualizado_en FROM contenido.configuracion) c`,
  );
  await vaciarTablas(bd, ['contenido.auditoria', 'contenido.usuario_interno']);
  await bd.query(
    `INSERT INTO contenido.configuracion (clave, valor, descripcion, actualizado_en)
     SELECT clave, valor, descripcion, actualizado_en
       FROM json_populate_recordset(NULL::contenido.configuracion, $1::json)`,
    [JSON.stringify(rows[0]?.filas ?? [])],
  );
}
