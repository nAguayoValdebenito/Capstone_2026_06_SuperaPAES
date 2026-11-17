// Lógica de `npm run probar:bd`: adapta el archivo de pruebas del modelo (db/pruebas/modelo_bd.sql)
// al sistema donde corre, sin modificarlo, y evalúa los resultados que psql deja en un archivo.
// El archivo se ejecuta con psql porque usa sus comandos (\set, \o): no sirve el cliente de Node.

/** Separador de columnas que se pide a psql (-F): no aparece en los textos de los casos. */
export const SEPARADOR = '\u001f';

/** psql de la instalación de PostgreSQL 18 en Windows, que no lo agrega al PATH. */
const PSQL_WINDOWS = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';

export interface CasoModelo {
  numero: number;
  grupo: string;
  caso: string;
  esperado: string;
  obtenido: string;
  motivo: string;
}

/**
 * Reescribe los `\o` del archivo: `\o /dev/null` pasa a `\o NUL` en Windows, y la salida a un archivo
 * (por ejemplo `\o /tmp/resultado_pruebas_v11.txt`) pasa a `archivoResultados`, que se puede leer
 * en cualquier sistema. Un `\o` sin destino (vuelve a la consola) no cambia.
 */
export function adaptarScript(
  contenido: string,
  plataforma: NodeJS.Platform,
  archivoResultados: string,
): string {
  const resultados = archivoResultados.replaceAll('\\', '/');
  return contenido.replaceAll(/^\\o[ \t]+(\S+)[ \t]*$/gm, (_linea, destino: string) => {
    if (destino === '/dev/null') return plataforma === 'win32' ? '\\o NUL' : '\\o /dev/null';
    return `\\o '${resultados}'`;
  });
}

/** Una fila `n, grupo, caso, esperado, obtenido, motivo`, o null si la línea no empieza un caso. */
function leerFila(linea: string): CasoModelo | null {
  const [primera = '', grupo = '', caso = '', esperado = '', obtenido, ...motivo] =
    linea.split(SEPARADOR);
  const numero = Number(primera);
  if (primera === '' || !Number.isInteger(numero) || obtenido === undefined) return null;
  return { numero, grupo, caso, esperado, obtenido, motivo: motivo.join(SEPARADOR) };
}

/** Lee los casos que psql escribió con -A -t -F. */
export function leerResultados(texto: string): CasoModelo[] {
  const casos: CasoModelo[] = [];
  for (const linea of texto.split(/\r?\n/)) {
    const caso = leerFila(linea);
    const anterior = casos.at(-1);
    if (caso) casos.push(caso);
    // Un motivo con saltos de línea continúa en las líneas siguientes.
    else if (linea !== '' && anterior) anterior.motivo = `${anterior.motivo} ${linea}`;
  }
  return casos;
}

/** Mismo criterio que el resumen del propio archivo de pruebas. */
export function casoCorrecto(caso: CasoModelo): boolean {
  return (
    caso.obtenido === caso.esperado ||
    (caso.esperado === 'rechazo' && caso.obtenido === 'rechazado')
  );
}

/** Correctos y total por grupo, en el orden en que aparecen. */
export function resumirPorGrupo(
  casos: readonly CasoModelo[],
): { grupo: string; correctos: number; total: number }[] {
  const grupos = new Map<string, { correctos: number; total: number }>();
  for (const caso of casos) {
    const actual = grupos.get(caso.grupo) ?? { correctos: 0, total: 0 };
    actual.total += 1;
    if (casoCorrecto(caso)) actual.correctos += 1;
    grupos.set(caso.grupo, actual);
  }
  return [...grupos].map(([grupo, cuenta]) => ({ grupo, ...cuenta }));
}

/** psql: la variable PSQL, `psql` del PATH o, en Windows, la instalación de PostgreSQL 18. */
export function encontrarPsql(
  entorno: Record<string, string | undefined>,
  plataforma: NodeJS.Platform,
  existe: (ruta: string) => boolean,
): string {
  if (entorno.PSQL) return entorno.PSQL;
  if (plataforma === 'win32' && existe(PSQL_WINDOWS)) return PSQL_WINDOWS;
  return 'psql';
}

/**
 * Variables de conexión de libpq para psql a partir de la URL, para no pasar la contraseña como
 * argumento (los argumentos de un proceso los ve cualquier usuario del equipo).
 */
export function entornoPsql(url: string, ssl: boolean): Record<string, string> {
  const u = new URL(url);
  return {
    PGHOST: u.hostname,
    PGPORT: u.port || '5432',
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.slice(1)),
    PGSSLMODE: ssl ? 'verify-full' : 'disable',
    PGCLIENTENCODING: 'UTF8',
  };
}
