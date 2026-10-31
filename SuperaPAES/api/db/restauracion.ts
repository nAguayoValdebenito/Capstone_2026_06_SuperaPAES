// Restauración de una copia del respaldo diario en una base aparte (TEC-08.2, CP-53; DAS 4.5.5, paso
// «Recuperar la base» fuera de la ventana de Neon). Nunca contra la base publicada: se niega si el
// destino es la base de URL_PRODUCCION o de DATABASE_URL, si no tiene con qué compararlo, o si el
// destino ya tiene tablas. Al terminar entrega las cantidades restauradas y las del respaldo.
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { descifrarArchivo, exigirClave } from './cifrado.js';
import { type DatosConexion, opcionesConexion } from './conexion.js';
import { ejecutarProceso, ErrorOperacion, partesSensibles } from './procesos.js';
import {
  type Cantidades,
  type CantidadesDelRespaldo,
  contarDatos,
  entornoLibpq,
  herramientaPostgres,
} from './copia-de-respaldo.js';
import type { Ejecutor } from './transaccion.js';

interface IdentidadBase {
  servidor: string;
  puerto: string;
  base: string;
}

function identidad(url: string, nombre: string): IdentidadBase {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new ErrorOperacion(`${nombre} no es una dirección de PostgreSQL válida.`);
  }
  return {
    servidor: u.hostname.toLowerCase(),
    puerto: u.port || '5432',
    base: decodeURIComponent(u.pathname.slice(1)),
  };
}

/** Misma base: mismo servidor, puerto y nombre (las ramas de Neon tienen servidores distintos). */
export function mismaBase(a: string, b: string): boolean {
  const x = identidad(a, 'La dirección');
  const y = identidad(b, 'La dirección');
  return x.servidor === y.servidor && x.puerto === y.puerto && x.base === y.base;
}

/**
 * Se niega si el destino es una de las bases de referencia (la publicada o la de DATABASE_URL), o si
 * no hay ninguna con qué compararlo.
 */
export function exigirDestinoDistinto(
  destino: string,
  referencias: Readonly<Record<string, string | undefined>>,
): void {
  identidad(destino, 'URL_DESTINO');
  const definidas = Object.entries(referencias).filter(
    (par): par is [string, string] => typeof par[1] === 'string' && par[1] !== '',
  );
  if (definidas.length === 0) {
    throw new ErrorOperacion(
      `No hay con qué comparar el destino: define ${Object.keys(referencias).join(' o ')} con la base publicada.`,
    );
  }
  for (const [nombre, url] of definidas) {
    if (mismaBase(destino, url)) {
      throw new ErrorOperacion(
        `URL_DESTINO es la misma base que ${nombre}: la restauración solo se hace en una base aparte.`,
      );
    }
  }
}

/** Falla si la base tiene alguna tabla, vista o secuencia fuera de los esquemas del sistema. */
export async function exigirBaseVacia(bd: Ejecutor): Promise<void> {
  const { rows } = await bd.query<{ objetos: string }>(
    `SELECT count(*) AS objetos FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg\\_toast%' AND n.nspname NOT LIKE 'pg\\_temp%'`,
  );
  if (Number(rows[0]?.objetos ?? 0) > 0) {
    throw new ErrorOperacion(
      'La base de destino no está vacía: la restauración solo se hace en una base PostgreSQL 18 nueva.',
    );
  }
}

export interface OpcionesRestauracion {
  archivo: string;
  /** Copia cifrada de las cantidades del mismo día (opcional). */
  archivoCantidades?: string | undefined;
  clave: string | undefined;
  destino: DatosConexion;
  /** Bases donde nunca se restaura, por nombre de variable (URL_PRODUCCION, DATABASE_URL). */
  referencias: Readonly<Record<string, string | undefined>>;
}

export interface ResultadoRestauracion {
  restauradas: Cantidades;
  respaldo: CantidadesDelRespaldo | null;
}

async function conDestino<T>(destino: DatosConexion, trabajo: (bd: pg.Client) => Promise<T>) {
  const cliente = new pg.Client(opcionesConexion(destino));
  await cliente.connect();
  try {
    return await trabajo(cliente);
  } finally {
    await cliente.end();
  }
}

export async function restaurarRespaldo(
  opciones: OpcionesRestauracion,
): Promise<ResultadoRestauracion> {
  const clave = exigirClave(opciones.clave);
  const { url, ssl } = opciones.destino;
  exigirDestinoDistinto(url, opciones.referencias);
  await conDestino(opciones.destino, exigirBaseVacia);
  const temporal = await mkdtemp(path.join(tmpdir(), 'restauracion-'));
  try {
    const volcado = path.join(temporal, 'base.dump');
    await descifrarArchivo(opciones.archivo, volcado, clave);
    const entorno = entornoLibpq(url, ssl);
    await ejecutarProceso(
      herramientaPostgres('pg_restore'),
      [
        '--no-owner',
        '--no-privileges',
        '--exit-on-error',
        '--single-transaction',
        '--dbname',
        entorno['PGDATABASE'] ?? '',
        volcado,
      ],
      { entorno, sensibles: partesSensibles(url) },
    );
    const respaldo = opciones.archivoCantidades
      ? await leerCantidades(opciones.archivoCantidades, clave, temporal)
      : null;
    return { restauradas: await conDestino(opciones.destino, contarDatos), respaldo };
  } finally {
    await rm(temporal, { recursive: true, force: true });
  }
}

async function leerCantidades(
  archivo: string,
  clave: string,
  temporal: string,
): Promise<CantidadesDelRespaldo> {
  const plano = path.join(temporal, 'cantidades.json');
  await descifrarArchivo(archivo, plano, clave);
  return JSON.parse(await readFile(plano, 'utf8')) as CantidadesDelRespaldo;
}
