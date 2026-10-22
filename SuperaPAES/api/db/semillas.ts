// Ejecuta en orden los archivos .sql de db/semillas, cada uno en su propia transacción.
// Las semillas son idempotentes (nunca borran filas): se pueden ejecutar todas las veces que haga falta.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';
import { conBloqueo } from './bloqueo.js';
import { esArchivoDeMigracion, quitarControlDeTransaccion } from './migrador.js';
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

/**
 * Semillas que no se cargan, según la variable SEMILLAS_OMITIDAS (nombres separados por comas).
 * Es un interruptor de despliegue, no un parámetro de negocio: en la base publicada se omite
 * 003_documentos_legales.sql hasta que un docente o el cliente revise el texto (RN-30).
 */
export function leerSemillasOmitidas(entorno: Record<string, string | undefined>): string[] {
  return (entorno.SEMILLAS_OMITIDAS ?? '')
    .split(',')
    .map((nombre) => nombre.trim())
    .filter((nombre) => nombre !== '');
}

/** Devuelve los nombres de las semillas ejecutadas, sin las omitidas. */
export async function ejecutarSemillas(
  cliente: pg.ClientBase,
  directorio: string,
  omitidas: readonly string[] = [],
): Promise<string[]> {
  const todas = await listarSemillas(directorio);
  // Un nombre mal escrito no debe cargar en silencio la semilla que se quería omitir (RN-30).
  const desconocidas = omitidas.filter((nombre) => !todas.includes(nombre));
  if (desconocidas.length > 0) {
    throw new ErrorSemilla(
      `SEMILLAS_OMITIDAS nombra semillas que no existen: ${desconocidas.join(', ')}`,
    );
  }
  const nombres = todas.filter((nombre) => !omitidas.includes(nombre));
  return conBloqueo(cliente, CLAVE_BLOQUEO, async () => {
    for (const nombre of nombres) {
      const contenido = quitarControlDeTransaccion(
        await readFile(path.join(directorio, nombre), 'utf8'),
      );
      try {
        await ejecutarEnTransaccion(cliente, (tx) => tx.query(contenido));
      } catch (error) {
        throw new ErrorSemilla(`Falló la semilla ${nombre}`, { cause: error });
      }
    }
    return nombres;
  });
}
