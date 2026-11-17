// Llamada pública a /api/v1/app/cuentas/recuperacion (módulo cuentas de la API): la página A05 crea la
// contraseña nueva de un estudiante con el enlace de su correo (HU-06, CU-04). No usa la sesión de la
// consola: quien abre el enlace es el estudiante, en su teléfono.
import { solicitar } from '../api/cliente';

/** Cambia la contraseña con el token del enlace. Cierra las sesiones abiertas; no inicia sesión. */
export async function restablecerContrasena(token: string, contrasena: string): Promise<void> {
  await solicitar<{ restablecida: boolean }>('/app/cuentas/recuperacion/restablecer', {
    method: 'POST',
    body: JSON.stringify({ token, contrasena }),
  });
}
