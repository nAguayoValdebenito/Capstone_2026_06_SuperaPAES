// Contraseñas cifradas de las cuentas de prueba (con cifrarContrasena, el componente que usa el ingreso).
import { cifrarContrasena } from '../comun/contrasenas.js';

/** bcrypt con costo 12 tarda: cada contraseña de prueba se cifra una sola vez por archivo. */
const hashes = new Map<string, Promise<string>>();
export function hashDeContrasena(contrasena: string): Promise<string> {
  const guardado = hashes.get(contrasena) ?? cifrarContrasena(contrasena);
  hashes.set(contrasena, guardado);
  return guardado;
}
