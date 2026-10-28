// Proveedor de correo por SMTP: Brevo en producción y Mailpit en desarrollo.
import nodemailer from 'nodemailer';
import type { ConfiguracionCorreo } from '../../comun/configuracion.js';
import { registro } from '../../comun/registro.js';
import type { MensajeCorreo, ProveedorCorreo } from './proveedor.js';

export type OpcionesSmtp = Omit<Extract<ConfiguracionCorreo, { proveedor: 'smtp' }>, 'proveedor'>;

class ErrorEnvioCorreoSmtp extends Error {
  constructor() {
    super('No se pudo enviar el correo por SMTP.');
    this.name = 'ErrorEnvioCorreoSmtp';
  }
}

export class ProveedorCorreoSmtp implements ProveedorCorreo {
  readonly nombre = 'smtp';

  constructor(private readonly opciones: OpcionesSmtp) {}

  async enviar(mensaje: MensajeCorreo): Promise<void> {
    const { host, puerto, tls, usuario, clave, remitente, timeoutMs } = this.opciones;
    const transporte = nodemailer.createTransport({
      host,
      port: puerto,
      secure: tls === 'implicit',
      requireTLS: tls === 'starttls',
      ignoreTLS: tls === 'none',
      auth:
        usuario !== undefined && clave !== undefined ? { user: usuario, pass: clave } : undefined,
      connectionTimeout: timeoutMs,
      greetingTimeout: timeoutMs,
      socketTimeout: timeoutMs,
    });

    try {
      await transporte.sendMail({
        from: { name: 'Supera PAES', address: remitente },
        to: mensaje.para,
        subject: mensaje.asunto,
        text: mensaje.texto,
        html: mensaje.html,
      });
    } catch (error) {
      // No se registra el mensaje del cliente SMTP: puede contener direcciones o datos del servidor.
      registro.error('No se pudo enviar el correo por SMTP', {
        error: error instanceof Error ? error.name : 'desconocido',
      });
      throw new ErrorEnvioCorreoSmtp();
    } finally {
      transporte.close();
    }
  }
}
