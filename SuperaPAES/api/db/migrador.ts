// Aplica las migraciones .sql numeradas que falten y las registra en public.migracion_aplicada.
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';
import { conBloqueo } from './bloqueo.js';
import { ejecutarEnTransaccion } from './transaccion.js';

// Clave fija del bloqueo de PostgreSQL que evita dos migraciones simultáneas.
const CLAVE_BLOQUEO = 20270101;

export interface ArchivoMigracion {
  nombre: string;
  contenido: string;
  suma: string;
}

export interface MigracionAplicada {
  nombre: string;
  suma: string;
}

export class ErrorMigracion extends Error {
  override name = 'ErrorMigracion';
}

export function esArchivoDeMigracion(nombre: string): boolean {
  return /^\d{3}_[\w-]+\.sql$/.test(nombre);
}

/** SHA-256 del archivo con fines de línea LF, para que Windows y Linux calculen la misma suma. */
export function calcularSuma(contenido: string): string {
  return createHash('sha256').update(contenido.replaceAll('\r\n', '\n'), 'utf8').digest('hex');
}

export function planificarMigraciones(
  archivos: ArchivoMigracion[],
  aplicadas: MigracionAplicada[],
): ArchivoMigracion[] {
  const porNumero = new Map<string, string>();
  for (const { nombre } of archivos) {
    const numero = nombre.slice(0, 3);
    const repetido = porNumero.get(numero);
    if (repetido) {
      throw new ErrorMigracion(
        `Las migraciones ${repetido} y ${nombre} comparten el número ${numero}.`,
      );
    }
    porNumero.set(numero, nombre);
  }

  const porNombre = new Map(archivos.map((a) => [a.nombre, a]));
  for (const aplicada of aplicadas) {
    const archivo = porNombre.get(aplicada.nombre);
    if (!archivo) {
      throw new ErrorMigracion(`La migración aplicada ${aplicada.nombre} ya no existe en disco.`);
    }
    if (archivo.suma !== aplicada.suma) {
      throw new ErrorMigracion(
        `La migración ${aplicada.nombre} cambió después de aplicarse. Crea una migración nueva en vez de editarla.`,
      );
    }
  }
  const nombresAplicados = new Set(aplicadas.map((a) => a.nombre));
  const pendientes = archivos
    .filter((a) => !nombresAplicados.has(a.nombre))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  // Una migración pendiente anterior a la última aplicada dejaría historiales distintos por entorno.
  const ultimaAplicada = aplicadas
    .map((a) => a.nombre)
    .sort()
    .at(-1);
  const atrasada = ultimaAplicada && pendientes.find((p) => p.nombre < ultimaAplicada);
  if (atrasada) {
    throw new ErrorMigracion(
      `La migración ${atrasada.nombre} es anterior a ${ultimaAplicada}, que ya se aplicó. Renúmerala después de la última.`,
    );
  }
  return pendientes;
}

async function leerArchivosDeMigracion(directorio: string): Promise<ArchivoMigracion[]> {
  const nombres = (await readdir(directorio)).filter(esArchivoDeMigracion);
  return Promise.all(
    nombres.map(async (nombre) => {
      const contenido = await readFile(path.join(directorio, nombre), 'utf8');
      return { nombre, contenido, suma: calcularSuma(contenido) };
    }),
  );
}

/** Devuelve los nombres de las migraciones aplicadas en esta ejecución. */
export async function migrar(cliente: pg.ClientBase, directorio: string): Promise<string[]> {
  return conBloqueo(cliente, CLAVE_BLOQUEO, async () => {
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS public.migracion_aplicada (
        nombre VARCHAR(200) PRIMARY KEY,
        suma_sha256 CHAR(64) NOT NULL,
        aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    const { rows } = await cliente.query<MigracionAplicada>(
      'SELECT nombre, suma_sha256 AS suma FROM public.migracion_aplicada',
    );
    const pendientes = planificarMigraciones(await leerArchivosDeMigracion(directorio), rows);

    for (const migracion of pendientes) {
      try {
        await ejecutarEnTransaccion(cliente, async (transaccion) => {
          await transaccion.query(migracion.contenido);
          await transaccion.query(
            'INSERT INTO public.migracion_aplicada (nombre, suma_sha256) VALUES ($1, $2)',
            [migracion.nombre, migracion.suma],
          );
        });
      } catch (error) {
        throw new ErrorMigracion(`Falló la migración ${migracion.nombre}`, { cause: error });
      }
    }
    return pendientes.map((m) => m.nombre);
  });
}
