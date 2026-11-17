// Programas externos de los scripts de contingencia (TEC-08, DAS 4.5.5): pg_dump, pg_restore y gpg.
// Ninguna dirección de base ni clave va como argumento (los argumentos de un proceso los ve cualquier
// usuario del equipo): la conexión llega por variables de libpq y la clave por la entrada estándar.
// Todo lo que estos programas escriben se limpia antes de mostrarse, porque sus errores pueden traer
// el servidor, el usuario o el nombre de la base.
import { spawn } from 'node:child_process';

export class ErrorOperacion extends Error {
  override name = 'ErrorOperacion';
}

export type Herramienta = 'pg_dump' | 'pg_restore' | 'gpg';

/** Variable de entorno que permite indicar la ruta de cada programa (por ejemplo, en la CI). */
const VARIABLE: Record<Herramienta, string> = {
  pg_dump: 'PG_DUMP',
  pg_restore: 'PG_RESTORE',
  gpg: 'GPG',
};

/** En Windows, PostgreSQL 18 y Git for Windows no agregan estos programas al PATH. */
const RUTA_WINDOWS: Record<Herramienta, string> = {
  pg_dump: 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe',
  pg_restore: 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe',
  gpg: 'C:\\Program Files\\Git\\usr\\bin\\gpg.exe',
};

/** La variable de la herramienta, su instalación en Windows o el nombre para buscarla en el PATH. */
export function encontrarHerramienta(
  herramienta: Herramienta,
  entorno: Record<string, string | undefined>,
  plataforma: NodeJS.Platform,
  existe: (ruta: string) => boolean,
): string {
  const indicada = entorno[VARIABLE[herramienta]];
  if (indicada) return indicada;
  const windows = RUTA_WINDOWS[herramienta];
  if (plataforma === 'win32' && existe(windows)) return windows;
  return herramienta;
}

const OCULTO = '[oculto]';
const URL_POSTGRES = /postgres(?:ql)?:\/\/\S+/gi;

/**
 * Partes de una dirección de PostgreSQL que no deben aparecer en una salida: la dirección completa,
 * el servidor, el usuario, la contraseña y el nombre de la base.
 */
export function partesSensibles(url: string | undefined): string[] {
  if (!url) return [];
  try {
    const u = new URL(url);
    return [
      url,
      u.hostname,
      decodeURIComponent(u.username),
      decodeURIComponent(u.password),
      decodeURIComponent(u.pathname.slice(1)),
    ];
  } catch {
    return [url];
  }
}

/** Reemplaza cada valor sensible (y cualquier dirección postgres://) por [oculto]. */
export function ocultarSecretos(texto: string, sensibles: readonly string[]): string {
  // Primero los más largos: así una contraseña que contiene el usuario no queda a medias.
  const valores = [...new Set(sensibles.filter((v) => v.length >= 3))].sort(
    (a, b) => b.length - a.length,
  );
  let limpio = texto.replaceAll(URL_POSTGRES, OCULTO);
  for (const valor of valores) limpio = limpio.split(valor).join(OCULTO);
  return limpio;
}

export interface OpcionesProceso {
  /** Variables que se agregan al entorno del proceso (por ejemplo, PGHOST o PGPASSWORD). */
  entorno?: Record<string, string>;
  /** Texto que recibe por la entrada estándar (la clave de gpg). */
  entrada?: string;
  /** Valores que se ocultan si el programa falla y su mensaje se muestra. */
  sensibles: readonly string[];
}

/** Ejecuta el programa y devuelve su salida estándar. Si termina con error, lanza su mensaje limpio. */
export function ejecutarProceso(
  programa: string,
  argumentos: readonly string[],
  opciones: OpcionesProceso,
): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const hijo = spawn(programa, argumentos, {
      env: { ...process.env, ...opciones.entorno },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const salida: Buffer[] = [];
    const errores: Buffer[] = [];
    hijo.stdout.on('data', (trozo: Buffer) => salida.push(trozo));
    hijo.stderr.on('data', (trozo: Buffer) => errores.push(trozo));
    hijo.on('error', (error) => {
      rechazar(
        new ErrorOperacion(`No se pudo ejecutar ${nombrePrograma(programa)}: ${error.message}`),
      );
    });
    hijo.on('close', (codigo) => {
      if (codigo === 0) return resolver(Buffer.concat(salida).toString('utf8'));
      const mensaje = ocultarSecretos(Buffer.concat(errores).toString('utf8').trim(), [
        ...opciones.sensibles,
        ...Object.values(opciones.entorno ?? {}),
      ]);
      rechazar(
        new ErrorOperacion(
          `${nombrePrograma(programa)} terminó con el código ${codigo ?? 'desconocido'}: ${mensaje}`,
        ),
      );
    });
    hijo.stdin.end(opciones.entrada ?? '');
  });
}

function nombrePrograma(programa: string): string {
  return (
    programa
      .split(/[\\/]/)
      .at(-1)
      ?.replace(/\.exe$/i, '') ?? programa
  );
}
