// Respaldo diario cifrado de la base publicada (TEC-08.1, RNF-07, DAS 4.5.5). Lo ejecuta el flujo
// programado de GitHub Actions con `npm run respaldar -w api`: pg_dump en formato personalizado, revisión
// de que el volcado no esté vacío, cantidades de la base (para comparar al restaurar, CP-53) y cifrado de
// las dos cosas con GnuPG. La copia sin cifrar solo existe en una carpeta temporal que se borra al final.
// La salida nunca muestra la dirección de la base, la clave ni datos de la base: solo nombres y tamaños.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { cifrarArchivo, descifrarArchivo, exigirClave } from './cifrado.js';
import { type DatosConexion, opcionesConexion } from './conexion.js';
import {
  ejecutarProceso,
  encontrarHerramienta,
  ErrorOperacion,
  partesSensibles,
} from './procesos.js';
import { entornoPsql } from './prueba-modelo.js';
import type { Ejecutor } from './transaccion.js';

/** Cantidades que se comparan al restaurar y al reintegrar (CP-39, CP-53 y CP-59). */
export interface Cantidades {
  estudiantes: number;
  usuariosInternos: number;
  preguntasPublicadas: number;
  evaluaciones: number;
  respuestas: number;
  suscripciones: number;
}

export interface CantidadesDelRespaldo {
  tomadasEn: string;
  cantidades: Cantidades;
}

export async function contarDatos(bd: Ejecutor): Promise<Cantidades> {
  const { rows } = await bd.query<Record<keyof Cantidades, string>>(
    `SELECT (SELECT count(*) FROM app.estudiante) AS estudiantes,
            (SELECT count(*) FROM contenido.usuario_interno) AS "usuariosInternos",
            (SELECT count(*) FROM contenido.v_preguntas_publicadas) AS "preguntasPublicadas",
            (SELECT count(*) FROM app.evaluacion) AS evaluaciones,
            (SELECT count(*) FROM app.evaluacion_item WHERE respondida_en IS NOT NULL) AS respuestas,
            (SELECT count(*) FROM app.suscripcion) AS suscripciones`,
  );
  const fila = rows[0];
  if (!fila) throw new ErrorOperacion('No se pudieron contar los datos de la base.');
  return {
    estudiantes: Number(fila.estudiantes),
    usuariosInternos: Number(fila.usuariosInternos),
    preguntasPublicadas: Number(fila.preguntasPublicadas),
    evaluaciones: Number(fila.evaluaciones),
    respuestas: Number(fila.respuestas),
    suscripciones: Number(fila.suscripciones),
  };
}

export function herramientaPostgres(nombre: 'pg_dump' | 'pg_restore'): string {
  return encontrarHerramienta(nombre, process.env, process.platform, existsSync);
}

/**
 * Variables de libpq para pg_dump y pg_restore. Con TLS (Neon) se exige verify-full, que necesita
 * certificados raíz: si no se indicó PGSSLROOTCERT, se usan los del sistema (libpq 16 o superior).
 */
export function entornoLibpq(
  url: string,
  ssl: boolean,
  entorno: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const variables = entornoPsql(url, ssl);
  return ssl && !entorno['PGSSLROOTCERT'] ? { ...variables, PGSSLROOTCERT: 'system' } : variables;
}

/** Falla si el volcado está vacío o no trae las tablas de los esquemas app y contenido. */
export async function verificarVolcado(archivo: string): Promise<void> {
  const { size } = await stat(archivo);
  if (size === 0) throw new ErrorOperacion('El volcado de pg_dump quedó vacío.');
  const indice = await ejecutarProceso(herramientaPostgres('pg_restore'), ['--list', archivo], {
    sensibles: [],
  });
  for (const esquema of ['app', 'contenido']) {
    if (!new RegExp(`\\bTABLE ${esquema} `).test(indice)) {
      throw new ErrorOperacion(`El volcado no trae las tablas del esquema ${esquema}.`);
    }
  }
}

async function sha256(archivo: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(archivo))
    .digest('hex');
}

async function tomarCantidades(conexion: DatosConexion): Promise<CantidadesDelRespaldo> {
  const cliente = new pg.Client(opcionesConexion(conexion));
  await cliente.connect();
  try {
    return { tomadasEn: new Date().toISOString(), cantidades: await contarDatos(cliente) };
  } finally {
    await cliente.end();
  }
}

export interface OpcionesRespaldo {
  conexion: DatosConexion;
  clave: string | undefined;
  /** Carpeta donde quedan las copias cifradas (la que sube el flujo como artefacto). */
  carpeta: string;
  /** Fecha del respaldo, para el nombre de los archivos (AAAA-MM-DD). */
  fecha: Date;
}

export interface CopiaCifrada {
  respaldo: string;
  cantidades: string;
  bytes: number;
}

/** Nombres de las dos copias de un día: el volcado y sus cantidades, ambos cifrados. */
export function nombresDeCopia(fecha: Date): { respaldo: string; cantidades: string } {
  const dia = fecha.toISOString().slice(0, 10);
  return {
    respaldo: `supera-paes-${dia}.dump.gpg`,
    cantidades: `supera-paes-${dia}.cantidades.json.gpg`,
  };
}

export async function respaldar(opciones: OpcionesRespaldo): Promise<CopiaCifrada> {
  const clave = exigirClave(opciones.clave);
  const { url, ssl } = opciones.conexion;
  const temporal = await mkdtemp(path.join(tmpdir(), 'respaldo-'));
  try {
    const volcado = path.join(temporal, 'base.dump');
    await ejecutarProceso(
      herramientaPostgres('pg_dump'),
      ['--format=custom', '--no-owner', '--no-privileges', '--file', volcado],
      { entorno: entornoLibpq(url, ssl), sensibles: partesSensibles(url) },
    );
    await verificarVolcado(volcado);
    const cantidades = path.join(temporal, 'cantidades.json');
    await writeFile(cantidades, JSON.stringify(await tomarCantidades(opciones.conexion)));

    await mkdir(opciones.carpeta, { recursive: true });
    const nombres = nombresDeCopia(opciones.fecha);
    const copia = {
      respaldo: path.join(opciones.carpeta, nombres.respaldo),
      cantidades: path.join(opciones.carpeta, nombres.cantidades),
    };
    try {
      await cifrarArchivo(volcado, copia.respaldo, clave);
      await cifrarArchivo(cantidades, copia.cantidades, clave);
      await comprobarCifrado(copia.respaldo, volcado, clave, temporal);
    } catch (error) {
      // Una copia a medias no debe llegar al artefacto.
      await Promise.all(Object.values(copia).map((archivo) => rm(archivo, { force: true })));
      throw error;
    }
    return { ...copia, bytes: (await stat(copia.respaldo)).size };
  } finally {
    await rm(temporal, { recursive: true, force: true });
  }
}

/** Descifra la copia recién hecha y la compara con el volcado: si el cifrado falló, el flujo falla. */
async function comprobarCifrado(
  cifrado: string,
  original: string,
  clave: string,
  temporal: string,
): Promise<void> {
  const prueba = path.join(temporal, 'comprobacion.dump');
  await descifrarArchivo(cifrado, prueba, clave);
  if ((await sha256(prueba)) !== (await sha256(original))) {
    throw new ErrorOperacion('La copia cifrada no coincide con el volcado: no se guardó.');
  }
}
