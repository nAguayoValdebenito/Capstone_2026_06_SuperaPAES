// Contraseñas de estudiantes y usuarios internos (RNF-01, RN-31, DAS 4.3.5): único lugar del servidor
// que cifra, compara y valida contraseñas. Ningún módulo usa bcrypt por su cuenta.
import bcrypt from 'bcryptjs';
import type { z } from 'zod';

/** Costo de bcrypt, el mismo en todo el servidor (RNF-01). */
export const COSTO_BCRYPT = 12;

export const LARGO_MINIMO_CONTRASENA = 8;
export const LARGO_MAXIMO_CONTRASENA = 72;
/** bcrypt solo considera los primeros 72 bytes en UTF-8 (una tilde o una ñ ocupan 2). */
export const MAXIMO_BYTES_CONTRASENA = 72;

export function cifrarContrasena(texto: string): Promise<string> {
  return bcrypt.hash(texto, COSTO_BCRYPT);
}

export function compararContrasena(texto: string, hash: string): Promise<boolean> {
  return bcrypt.compare(texto, hash);
}

/** Si la contraseña completa cabe en bcrypt (72 bytes en UTF-8). */
export function cabeEnBcrypt(texto: string): boolean {
  return Buffer.byteLength(texto, 'utf8') <= MAXIMO_BYTES_CONTRASENA;
}

/**
 * RN-31: de 8 a 72 caracteres y no más de 72 bytes, distinta del correo (sin distinguir mayúsculas).
 * No exige símbolos, mayúsculas ni números. Devuelve el requisito que falta, o null si la cumple.
 * La lista de contraseñas comunes de RN-31 se agrega aquí (HU-01.4) para que rija en todo el servidor.
 */
export function validarContrasena(texto: string, correo: string): string | null {
  const largo = [...texto].length;
  if (largo < LARGO_MINIMO_CONTRASENA) {
    return `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`;
  }
  if (largo > LARGO_MAXIMO_CONTRASENA || !cabeEnBcrypt(texto)) {
    return 'La contraseña es demasiado larga.';
  }
  if (texto.trim().toLowerCase() === correo.trim().toLowerCase()) {
    return 'La contraseña no puede ser igual al correo.';
  }
  return null;
}

/** Refinamiento de zod que aplica RN-31 a la contraseña nueva de un cuerpo con `contrasena` y `correo`. */
export function refinarContrasena(
  { contrasena, correo }: { contrasena: string; correo: string },
  contexto: z.RefinementCtx,
): void {
  const problema = validarContrasena(contrasena, correo);
  if (problema) contexto.addIssue({ code: 'custom', path: ['contrasena'], message: problema });
}
