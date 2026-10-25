// Contraseñas de estudiantes y usuarios internos (RNF-01, RN-31, DAS 4.3.5): único lugar del servidor
// que cifra, compara y valida contraseñas. Ningún módulo usa bcrypt por su cuenta.
import bcrypt from 'bcryptjs';
import type { z } from 'zod';
import { CONTRASENAS_COMUNES } from './contrasenas-comunes.js';

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

/** Requisito de RN-31 que no se cumple; la app y la consola lo muestran bajo el campo (CU-01 5.b). */
export type MotivoContrasena =
  | 'contrasena_corta'
  | 'contrasena_larga'
  | 'contrasena_bytes'
  | 'contrasena_igual_correo'
  | 'contrasena_comun';

export interface ProblemaContrasena {
  motivo: MotivoContrasena;
  mensaje: string;
}

/** Minúsculas y sin tildes, para comparar con la lista de comunes (la ñ también pasa a n). */
export function normalizarParaComparar(texto: string): string {
  return texto.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

const COMUNES = new Set(CONTRASENAS_COMUNES);

/**
 * RN-31 (HU-01.4): de 8 a 72 caracteres y no más de 72 bytes, distinta del correo y fuera de la lista
 * de contraseñas comunes (sin distinguir mayúsculas ni tildes). No exige símbolos, mayúsculas ni
 * números. Devuelve el primer requisito que falta, con su motivo, o null si la cumple. Rige en todo el
 * servidor: registro, contraseña nueva y usuarios internos.
 */
export function validarContrasena(texto: string, correo: string): ProblemaContrasena | null {
  const largo = [...texto].length;
  if (largo < LARGO_MINIMO_CONTRASENA) {
    const mensaje = `La contraseña debe tener al menos ${String(LARGO_MINIMO_CONTRASENA)} caracteres.`;
    return { motivo: 'contrasena_corta', mensaje };
  }
  if (largo > LARGO_MAXIMO_CONTRASENA) {
    const mensaje = `La contraseña puede tener hasta ${String(LARGO_MAXIMO_CONTRASENA)} caracteres.`;
    return { motivo: 'contrasena_larga', mensaje };
  }
  if (!cabeEnBcrypt(texto)) {
    return {
      motivo: 'contrasena_bytes',
      mensaje: 'La contraseña es demasiado larga: usa menos tildes, emojis o símbolos especiales.',
    };
  }
  if (texto.trim().toLowerCase() === correo.trim().toLowerCase()) {
    return {
      motivo: 'contrasena_igual_correo',
      mensaje: 'La contraseña no puede ser igual al correo.',
    };
  }
  if (COMUNES.has(normalizarParaComparar(texto))) {
    return {
      motivo: 'contrasena_comun',
      mensaje: 'Esa contraseña es muy común y fácil de adivinar. Elige otra.',
    };
  }
  return null;
}

/** Refinamiento de zod que aplica RN-31 a la contraseña nueva de un cuerpo con `contrasena` y `correo`. */
export function refinarContrasena(
  { contrasena, correo }: { contrasena: string; correo: string },
  contexto: z.RefinementCtx,
): void {
  const problema = validarContrasena(contrasena, correo);
  if (problema) {
    contexto.addIssue({
      code: 'custom',
      path: ['contrasena'],
      message: problema.mensaje,
      params: { motivo: problema.motivo },
    });
  }
}
