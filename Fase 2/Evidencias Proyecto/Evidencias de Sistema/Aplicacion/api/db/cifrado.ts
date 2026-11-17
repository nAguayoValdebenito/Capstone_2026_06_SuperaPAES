// Cifrado simétrico de las copias del respaldo diario con GnuPG (OpenPGP): AES-256, clave derivada con
// S2K salado e iterado (SHA-512, conteo máximo) y verificación de integridad, de modo que una copia
// alterada o una clave equivocada hacen fallar el descifrado. La clave llega por --passphrase-fd 0
// (entrada estándar), nunca como argumento, y gpg no la guarda en su agente (--no-symkey-cache).
import { existsSync } from 'node:fs';
import { ejecutarProceso, encontrarHerramienta, ErrorOperacion } from './procesos.js';

/** Largo mínimo de CLAVE_RESPALDO: la copia cifrada la puede descargar cualquiera con sesión en GitHub. */
export const LARGO_MINIMO_CLAVE = 32;

/** Rechaza una clave vacía o corta antes de cifrar o descifrar nada. */
export function exigirClave(clave: string | undefined): string {
  if (!clave) throw new ErrorOperacion('Falta CLAVE_RESPALDO.');
  if (clave.length < LARGO_MINIMO_CLAVE || /[\r\n]/.test(clave)) {
    throw new ErrorOperacion(
      `CLAVE_RESPALDO debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres aleatorios y ningún salto de línea.`,
    );
  }
  return clave;
}

function gpg(): string {
  return encontrarHerramienta('gpg', process.env, process.platform, existsSync);
}

const COMUNES = [
  '--batch',
  '--yes',
  '--quiet',
  '--no-symkey-cache',
  '--pinentry-mode',
  'loopback',
  '--passphrase-fd',
  '0',
];

/**
 * Cifra `entrada` en `salida`. El nombre guardado dentro de la copia es fijo, para no dejar la ruta del
 * equipo; no se comprime, porque el formato personalizado de pg_dump ya viene comprimido.
 */
export async function cifrarArchivo(entrada: string, salida: string, clave: string): Promise<void> {
  await ejecutarProceso(
    gpg(),
    [
      ...COMUNES,
      '--symmetric',
      '--cipher-algo',
      'AES256',
      '--s2k-mode',
      '3',
      '--s2k-digest-algo',
      'SHA512',
      '--s2k-count',
      '65011712',
      '--compress-algo',
      'none',
      '--set-filename',
      'respaldo',
      '--output',
      salida,
      entrada,
    ],
    { entrada: `${exigirClave(clave)}\n`, sensibles: [clave] },
  );
}

/** Descifra `entrada` en `salida`. Falla con una clave equivocada o una copia alterada. */
export async function descifrarArchivo(
  entrada: string,
  salida: string,
  clave: string,
): Promise<void> {
  const entradaClave = `${exigirClave(clave)}\n`;
  try {
    await ejecutarProceso(gpg(), [...COMUNES, '--output', salida, '--decrypt', entrada], {
      entrada: entradaClave,
      sensibles: [clave],
    });
  } catch (error) {
    if (!(error instanceof ErrorOperacion)) throw error;
    throw new ErrorOperacion(
      `No se pudo descifrar la copia: la clave no corresponde o el archivo está dañado o alterado. ${error.message}`,
    );
  }
}
