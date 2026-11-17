// Comprobación del ingreso con un hash de relleno para no revelar si el correo existe.
import { randomBytes } from 'node:crypto';
import { cifrarContrasena, compararContrasena } from '../../comun/contrasenas.js';
import { ErrorNoAutenticado } from '../../comun/errores.js';

let rellenoPendiente: Promise<string> | undefined;

/** Prepara una sola vez el hash al azar usado cuando el correo no tiene cuenta. */
export function hashDeRelleno(): Promise<string> {
  rellenoPendiente ??= cifrarContrasena(randomBytes(16).toString('hex'));
  return rellenoPendiente;
}

/** Siempre compara con bcrypt y responde igual para correo o contraseña incorrectos. */
export async function comprobarCredenciales<C extends { hashContrasena: string }>(
  cuenta: C | null,
  contrasena: string,
): Promise<C> {
  const hash = cuenta?.hashContrasena ?? (await hashDeRelleno());
  const correcta = await compararContrasena(contrasena, hash);
  if (!cuenta || !correcta) throw new ErrorNoAutenticado('Correo o contraseña incorrectos.');
  return cuenta;
}
