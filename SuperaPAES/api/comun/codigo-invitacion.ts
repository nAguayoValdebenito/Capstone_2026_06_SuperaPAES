// Formato del código de invitación (RN-33, CHECK de app.estudiante.codigo_invitacion): 6 letras
// mayúsculas o números, sin 0, O, 1 ni I. Lo usan el registro (cuentas) y el canje (cupo-invitaciones).
import { randomInt } from 'node:crypto';
import { z } from 'zod';

/** Letras mayúsculas sin I ni O y dígitos del 2 al 9: los que no se confunden (RN-33). */
export const ALFABETO_CODIGO_INVITACION = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const LARGO_CODIGO_INVITACION = 6;

export const codigoInvitacion = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{6}$/, 'El código de invitación tiene 6 letras o números.');

/**
 * Código de invitación propio de un estudiante nuevo, al azar con crypto.randomInt. Puede repetir el de
 * otra cuenta (1 en más de mil millones): la base lo rechaza por su índice único y el registro
 * reintenta con otro.
 */
export function generarCodigoInvitacion(): string {
  let codigo = '';
  for (let i = 0; i < LARGO_CODIGO_INVITACION; i++) {
    codigo += ALFABETO_CODIGO_INVITACION[randomInt(ALFABETO_CODIGO_INVITACION.length)];
  }
  return codigo;
}
