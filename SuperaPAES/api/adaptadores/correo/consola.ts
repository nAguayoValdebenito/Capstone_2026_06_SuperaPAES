// Proveedor de correo de desarrollo: no envía nada, escribe el mensaje completo en el registro de la API
// para poder probar los enlaces y los códigos (RN-32). La configuración lo prohíbe en producción, así
// que ningún registro de la versión publicada contiene un enlace ni un código.
import { registro } from '../../comun/registro.js';
import type { MensajeCorreo, ProveedorCorreo } from './proveedor.js';

export class ProveedorCorreoConsola implements ProveedorCorreo {
  readonly nombre = 'consola';

  enviar({ para, asunto, texto }: MensajeCorreo): Promise<void> {
    registro.info('Correo (proveedor consola de desarrollo: no se envía)', { para, asunto, texto });
    return Promise.resolve();
  }
}
