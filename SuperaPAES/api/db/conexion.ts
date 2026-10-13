// Conexión a PostgreSQL: pool de la API y chequeo de salud con tiempo límite.
// Es infraestructura: el SQL de dominio vive en los repositorios de cada módulo.
import pg from 'pg';
import { registro } from '../comun/registro.js';

const LIMITE_CONEXION_MS = 3000;
const LIMITE_SALUD_MS = 3000;

export interface DatosConexion {
  url: string;
  ssl: boolean;
}

/** Opciones comunes de conexión para el pool de la API y el cliente de los scripts. */
export function opcionesConexion(baseDeDatos: DatosConexion): pg.ClientConfig {
  return {
    connectionString: baseDeDatos.url,
    // En Neon y otros servicios administrados se exige TLS con certificado válido.
    ssl: baseDeDatos.ssl ? { rejectUnauthorized: true } : false,
  };
}

export function crearPool(baseDeDatos: DatosConexion): pg.Pool {
  const pool = new pg.Pool({
    ...opcionesConexion(baseDeDatos),
    connectionTimeoutMillis: LIMITE_CONEXION_MS,
    max: 10,
  });
  // Un cliente inactivo que pierde la conexión emite 'error'; sin este manejador el proceso cae.
  pool.on('error', (error) => {
    registro.error('Error en el pool de PostgreSQL', { error: error.message });
  });
  return pool;
}

interface Consultable {
  query(sql: string): Promise<unknown>;
}

/** Ejecuta SELECT 1 y falla si la base no responde dentro del límite (por ejemplo, Neon suspendido). */
export async function comprobarBaseDeDatos(
  pool: Consultable,
  limiteMs = LIMITE_SALUD_MS,
): Promise<void> {
  let temporizador: NodeJS.Timeout | undefined;
  const vencimiento = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => {
      rechazar(
        new Error(`La base de datos no respondió dentro del tiempo límite de ${limiteMs} ms`),
      );
    }, limiteMs);
  });
  try {
    await Promise.race([pool.query('SELECT 1'), vencimiento]);
  } finally {
    clearTimeout(temporizador);
  }
}
