// Comprobación del ingreso con un hash de relleno para no revelar si el correo existe, y confirmación de
// la contraseña del estudiante de la sesión antes de borrar su cuenta o descargar sus datos.
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

const CONTRASENA_INCORRECTA = 'La contraseña no es correcta.';

/** El hash de la contraseña de un estudiante por su id; null si no existe o se eliminó. */
type BuscarHash = (id: string) => Promise<{ hashContrasena: string } | null>;

export interface ConfirmacionContrasena {
  /**
   * Confirma la contraseña del estudiante de la sesión antes de borrar su cuenta o entregar sus datos.
   * Compara siempre con bcrypt, como el ingreso. Incorrecta o cuenta eliminada: 401 «La contraseña no
   * es correcta.».
   */
  confirmarContrasenaEstudiante(id: string, contrasena: string): Promise<void>;
}

export function crearConfirmacionContrasena(buscarHash: BuscarHash): ConfirmacionContrasena {
  return {
    confirmarContrasenaEstudiante: async (id, contrasena) => {
      try {
        await comprobarCredenciales(await buscarHash(id), contrasena);
      } catch (error) {
        if (error instanceof ErrorNoAutenticado)
          throw new ErrorNoAutenticado(CONTRASENA_INCORRECTA);
        throw error;
      }
    },
  };
}
