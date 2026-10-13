// Utilidades compartidas por los scripts de base de datos (migrar y semillas).
import { existsSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { ErrorConfiguracion, leerConfiguracionBaseDeDatos } from '../../comun/configuracion.js';
import { opcionesConexion } from '../conexion.js';

/**
 * Busca db/<carpeta> subiendo desde este archivo. Sirve desde db/scripts/ (desarrollo, con tsx)
 * y desde dist/db/scripts/ (compilado), porque tsc no copia los .sql a dist.
 */
export function encontrarCarpeta(carpeta: 'migraciones' | 'semillas'): string {
  let actual = import.meta.dirname;
  while (true) {
    const candidato = path.join(actual, 'db', carpeta);
    if (existsSync(candidato)) return candidato;
    const padre = path.dirname(actual);
    if (padre === actual) throw new Error(`No se encontró la carpeta db/${carpeta}.`);
    actual = padre;
  }
}

/** Conecta con la base (solo necesita DATABASE_URL y DATABASE_SSL), ejecuta y cierra la conexión. */
export function ejecutarScript(trabajo: (cliente: pg.Client) => Promise<void>): void {
  const principal = async () => {
    const cliente = new pg.Client({
      ...opcionesConexion(leerConfiguracionBaseDeDatos()),
      connectionTimeoutMillis: 10_000,
    });
    await cliente.connect();
    try {
      await trabajo(cliente);
    } finally {
      await cliente.end();
    }
  };
  principal().catch((error: unknown) => {
    // Node imprime el error con su cadena de causas (por ejemplo, el error SQL del archivo).
    console.error(error instanceof ErrorConfiguracion ? error.message : error);
    process.exitCode = 1;
  });
}
