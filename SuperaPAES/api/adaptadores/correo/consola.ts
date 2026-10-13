// Proveedor de correo que solo registrará los mensajes en la consola. Esqueleto por ahora.
import { ErrorNoImplementado } from '../../comun/errores.js';
import type { ProveedorCorreo } from './proveedor.js';

export class ProveedorCorreoConsola implements ProveedorCorreo {
  readonly nombre = 'consola';

  enviar(): Promise<void> {
    return Promise.reject(new ErrorNoImplementado('El registro de correos en consola'));
  }
}
