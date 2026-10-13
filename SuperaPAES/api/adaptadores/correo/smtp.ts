// Proveedor de correo por SMTP (Mailpit en local). Esqueleto: se implementará con el registro.
import { ErrorNoImplementado } from '../../comun/errores.js';
import type { ConfiguracionCorreo } from '../../comun/configuracion.js';
import type { ProveedorCorreo } from './proveedor.js';

export type OpcionesSmtp = Omit<Extract<ConfiguracionCorreo, { proveedor: 'smtp' }>, 'proveedor'>;

export class ProveedorCorreoSmtp implements ProveedorCorreo {
  readonly nombre = 'smtp';

  constructor(private readonly opciones: OpcionesSmtp) {}

  enviar(): Promise<void> {
    return Promise.reject(new ErrorNoImplementado('El envío de correos por SMTP'));
  }
}
