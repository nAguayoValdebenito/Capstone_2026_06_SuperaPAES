// Ejecuta en orden los archivos .sql de db/semillas, cada uno en su propia transacción.
// Las semillas son idempotentes (nunca borran filas): se pueden ejecutar todas las veces que haga falta.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';
import { conBloqueo } from './bloqueo.js';
import { esArchivoDeMigracion } from './migrador.js';
import { ejecutarEnTransaccion } from './transaccion.js';

// Clave fija del bloqueo de PostgreSQL que evita dos cargas de semillas simultáneas.
const CLAVE_BLOQUEO = 20270102;

export class ErrorSemilla extends Error {
  override name = 'ErrorSemilla';
}

/** Mismo formato de nombre que las migraciones: NNN_descripcion.sql. */
async function listarSemillas(directorio: string): Promise<string[]> {
  return (await readdir(directorio)).filter(esArchivoDeMigracion).sort();
}

/** Devuelve los nombres de las semillas ejecutadas. */
export async function ejecutarSemillas(
  cliente: pg.ClientBase,
  directorio: string,
): Promise<string[]> {
  const nombres = await listarSemillas(directorio);
  return conBloqueo(cliente, CLAVE_BLOQUEO, async () => {
    for (const nombre of nombres) {
      const contenido = await readFile(path.join(directorio, nombre), 'utf8');
      try {
        await ejecutarEnTransaccion(cliente, (tx) => tx.query(contenido));
      } catch (error) {
        throw new ErrorSemilla(`Falló la semilla ${nombre}`, { cause: error });
      }
    }
    return nombres;
  });
}
