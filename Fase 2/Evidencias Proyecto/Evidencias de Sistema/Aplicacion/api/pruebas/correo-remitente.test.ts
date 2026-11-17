// TEC-07 (DAS 2.5): los correos salen con un nombre visible («Supera PAES» por defecto) que se
// configura en CORREO_REMITENTE_NOMBRE, aparte de la dirección de CORREO_REMITENTE.
import { describe, expect, it } from 'vitest';
import { leerConfiguracion } from '../comun/configuracion.js';

const base = {
  // secretlint-disable-next-line
  DATABASE_URL: 'postgres://usuario:clave@localhost:5432/base',
  JWT_SECRETO_CONSOLA: 'a'.repeat(48),
  JWT_SECRETO_APP: 'b'.repeat(48),
  URL_CONSOLA: 'http://localhost:5173',
  CORS_ORIGENES: 'http://localhost:5173',
  CLAVE_CODIGO_CORREO: 'c'.repeat(48),
  PROVEEDOR_CORREO: 'smtp',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_TLS: 'none',
  CORREO_REMITENTE: 'no-responder@ejemplo.cl',
};

function nombreDe(extra: Record<string, string>) {
  const { correo } = leerConfiguracion({ ...base, ...extra });
  return correo.proveedor === 'smtp' ? correo.remitenteNombre : undefined;
}

describe('nombre visible del remitente', () => {
  it('usa «Supera PAES» si CORREO_REMITENTE_NOMBRE falta o está vacía', () => {
    expect(nombreDe({})).toBe('Supera PAES');
    expect(nombreDe({ CORREO_REMITENTE_NOMBRE: '' })).toBe('Supera PAES');
  });

  it('usa el nombre indicado, con tildes y ñ, sin espacios a los lados', () => {
    expect(nombreDe({ CORREO_REMITENTE_NOMBRE: '  Equipo Supera PAES Año 2026 ' })).toBe(
      'Equipo Supera PAES Año 2026',
    );
  });

  it.each([
    ['un salto de línea', 'Supera\nBcc: otra@ejemplo.cl'],
    ['un retorno de carro', 'Supera\rBcc: otra@ejemplo.cl'],
    ['un carácter de control', 'Supera\u0000PAES'],
    ['una dirección entre < >', 'Supera <otra@ejemplo.cl>'],
    ['comillas', 'Supera "PAES"'],
    ['una barra invertida', 'Supera\\PAES'],
    ['más de 80 caracteres', 'a'.repeat(81)],
  ])('rechaza un nombre con %s', (_caso, nombre) => {
    expect(() => leerConfiguracion({ ...base, CORREO_REMITENTE_NOMBRE: nombre })).toThrow(
      /CORREO_REMITENTE_NOMBRE/,
    );
  });

  it('el error no repite el valor escrito', () => {
    const intento = () =>
      leerConfiguracion({ ...base, CORREO_REMITENTE_NOMBRE: 'Secreto\nBcc: x@y.cl' });
    expect(intento).toThrow(/CORREO_REMITENTE_NOMBRE/);
    expect(intento).not.toThrow(/Secreto/);
  });

  it('no es obligatoria: sin ella la configuración con SMTP es válida', () => {
    expect(() => leerConfiguracion(base)).not.toThrow();
  });
});

describe('CORREO_REMITENTE solo lleva la dirección', () => {
  it('si se escribe «Nombre <correo>», dice que el nombre va en la otra variable', () => {
    const intento = () =>
      leerConfiguracion({ ...base, CORREO_REMITENTE: 'Supera PAES <no-responder@ejemplo.cl>' });
    expect(intento).toThrow(/CORREO_REMITENTE: lleva solo la dirección/);
    expect(intento).toThrow(/CORREO_REMITENTE_NOMBRE/);
  });

  it('una dirección inválida sigue rechazándose', () => {
    expect(() => leerConfiguracion({ ...base, CORREO_REMITENTE: 'sin-arroba' })).toThrow(
      /CORREO_REMITENTE/,
    );
  });
});
