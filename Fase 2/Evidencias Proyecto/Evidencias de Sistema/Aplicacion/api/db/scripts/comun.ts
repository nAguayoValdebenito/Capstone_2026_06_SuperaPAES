// Utilidades compartidas por los scripts de base de datos (migrar, semillas, probar:bd y los de
// contingencia: respaldar, restaurar-respaldo y reintegrar).
import { existsSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { ErrorConfiguracion, leerConfiguracionBaseDeDatos } from '../../comun/configuracion.js';
import { opcionesConexion } from '../conexion.js';
import { ocultarSecretos, partesSensibles } from '../procesos.js';

/**
 * Busca db/<carpeta> subiendo desde este archivo. Sirve desde db/scripts/ (desarrollo, con tsx)
 * y desde dist/db/scripts/ (compilado), porque tsc no copia los .sql a dist.
 */
export function encontrarCarpeta(carpeta: 'migraciones' | 'semillas' | 'pruebas'): string {
  let actual = import.meta.dirname;
  while (true) {
    const candidato = path.join(actual, 'db', carpeta);
    if (existsSync(candidato)) return candidato;
    const padre = path.dirname(actual);
    if (padre === actual) throw new Error(`No se encontró la carpeta db/${carpeta}.`);
    actual = padre;
  }
}

/**
 * Ejecuta un comando de contingencia (respaldar, restaurar-respaldo, reintegrar). Si falla, muestra solo
 * el mensaje del error con las direcciones de las bases y la clave ocultas: los registros del flujo de
 * respaldo son públicos y un error de conexión trae el servidor, el usuario o el nombre de la base.
 */
export function ejecutarOperacion(
  trabajo: () => Promise<void>,
  variablesSensibles: readonly string[],
): void {
  trabajo().catch((error: unknown) => {
    const sensibles = variablesSensibles.flatMap((nombre) => [
      ...partesSensibles(process.env[nombre]),
      process.env[nombre] ?? '',
    ]);
    const mensaje = error instanceof Error ? error.message : 'error desconocido';
    console.error(`No se completó la operación: ${ocultarSecretos(mensaje, sensibles)}`);
    process.exitCode = 1;
  });
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
