// Interfaz común de los proveedores de correo (verificación de cuenta y recuperación de contraseña).

export interface MensajeCorreo {
  para: string;
  asunto: string;
  texto: string;
  html?: string;
}

export interface ProveedorCorreo {
  readonly nombre: 'smtp' | 'consola';
  enviar(mensaje: MensajeCorreo): Promise<void>;
}
