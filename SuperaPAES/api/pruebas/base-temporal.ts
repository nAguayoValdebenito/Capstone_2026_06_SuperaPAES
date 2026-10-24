// Base temporal de PostgreSQL para las pruebas que necesitan la base real (crear-admin, continuidad del
// administrador). Se crea con las migraciones y se borra al terminar. Se activa con DATABASE_URL; en la
// CI siempre está, y si falta, la prueba `exigirBaseEnCi` falla en vez de omitirse en silencio.
import path from 'node:path';
import pg from 'pg';
import { expect, it } from 'vitest';
import { migrar } from '../db/migrador.js';

export const urlBase = process.env['DATABASE_URL'];
export const MINUTO = 60_000;

/** En la CI, las pruebas con PostgreSQL no se pueden omitir. */
export function exigirBaseEnCi(): void {
  it.runIf(Boolean(process.env['CI']))(
    'la CI define DATABASE_URL, así que las pruebas con PostgreSQL no se omiten',
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
  // Nombre generado aquí (solo letras, números y _): se puede escribir en el SQL.
  const nombre = `supera_paes_prueba_${prefijo}_${Date.now()}`;
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
      await admin.query(`DROP DATABASE IF EXISTS ${nombre} WITH (FORCE)`);
      await admin.end();
    },
  };
}

/** La auditoría no admite DELETE (disparador): TRUNCATE no lo dispara y deja las tablas vacías. */
export async function vaciarCuentasInternas(bd: pg.Client): Promise<void> {
  await bd.query('TRUNCATE contenido.auditoria, contenido.usuario_interno CASCADE');
}
