import { describe, expect, it } from 'vitest';
import { leerConfiguracion } from '../comun/configuracion.js';
import { variablesMinimas as minimas } from './variables-configuracion.js';

const mailpit = {
  PROVEEDOR_CORREO: 'smtp',
  SMTP_HOST: 'mailpit',
  SMTP_PORT: '1025',
  SMTP_TLS: 'none',
  CORREO_REMITENTE: 'no-responder@ejemplo.cl',
};

describe('correo con Mailpit de Docker Compose', () => {
  it('acepta mailpit sin TLS ni credenciales fuera de producción', () => {
    expect(leerConfiguracion({ ...minimas, ...mailpit }).correo).toMatchObject({
      proveedor: 'smtp',
      host: 'mailpit',
      tls: 'none',
    });
  });

  it('en producción sigue exigiendo TLS para cualquier servidor que no sea localhost', () => {
    expect(() => leerConfiguracion({ ...minimas, NODE_ENV: 'production', ...mailpit })).toThrow(
      /SMTP_TLS[\s\S]*localhost/,
    );
  });
});
