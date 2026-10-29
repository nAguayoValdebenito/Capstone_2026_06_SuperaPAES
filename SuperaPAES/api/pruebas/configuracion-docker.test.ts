import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { leerConfiguracion } from '../comun/configuracion.js';
import { CLAVE_CODIGO_DE_PRUEBA, SECRETO_APP_DE_PRUEBA, SECRETO_DE_PRUEBA } from './ayudantes.js';

describe('configuración de Docker', () => {
  it('declara las variables obligatorias de la API y permite los proveedores locales', () => {
    const ejemplo = readFileSync(
      path.join(import.meta.dirname, '..', '..', '.env.docker.example'),
      'utf8',
    );
    const variables = Object.fromEntries(
      ejemplo
        .split(/\r?\n/)
        .filter((linea) => /^[A-Z][A-Z0-9_]*=/.test(linea))
        .map((linea) => {
          const separador = linea.indexOf('=');
          return [linea.slice(0, separador), linea.slice(separador + 1)];
        }),
    );

    for (const nombre of [
      'DATABASE_URL',
      'JWT_SECRETO_CONSOLA',
      'JWT_SECRETO_APP',
      'URL_CONSOLA',
      'CLAVE_CODIGO_CORREO',
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_TLS',
      'SMTP_USUARIO',
      'SMTP_CLAVE',
      'CORREO_REMITENTE',
      'DEEPSEEK_API_KEY',
      'GEMINI_API_KEY',
      'GEMINI_MODELO',
    ]) {
      expect(variables, `falta ${nombre} en .env.docker.example`).toHaveProperty(nombre);
    }

    const configuracion = leerConfiguracion({
      ...variables,
      // Datos ficticios: el ejemplo deja los secretos vacíos para que Compose exija completarlos.
      // secretlint-disable-next-line
      DATABASE_URL: 'postgres://supera:prueba@db:5432/supera_paes',
      JWT_SECRETO_CONSOLA: SECRETO_DE_PRUEBA,
      JWT_SECRETO_APP: SECRETO_APP_DE_PRUEBA,
      CLAVE_CODIGO_CORREO: CLAVE_CODIGO_DE_PRUEBA,
    });

    expect(configuracion.entorno).toBe('development');
    expect(configuracion.ia.proveedor).toBe('simulado');
    expect(configuracion.correo.proveedor).toBe('consola');
    expect(configuracion.pagos.proveedor).toBe('simulado');
    expect(variables['DEEPSEEK_API_KEY']).toBe('');
    expect(variables['GEMINI_API_KEY']).toBe('');

    const iaReal = leerConfiguracion({
      ...variables,
      ...{
        DATABASE_URL: 'postgres://supera:prueba@db:5432/supera_paes', // secretlint-disable-line
        JWT_SECRETO_CONSOLA: SECRETO_DE_PRUEBA,
        JWT_SECRETO_APP: SECRETO_APP_DE_PRUEBA,
        CLAVE_CODIGO_CORREO: CLAVE_CODIGO_DE_PRUEBA,
      },
      PROVEEDOR_IA: 'deepseek',
      DEEPSEEK_API_KEY: 'clave-principal-ficticia',
      GEMINI_API_KEY: 'respaldo-ficticio',
    });
    expect(iaReal.ia).toEqual({
      proveedor: 'deepseek',
      claveApi: 'clave-principal-ficticia',
      respaldo: { claveApi: 'respaldo-ficticio', modelo: 'gemini-3.5-flash-lite' },
    });

    const smtpLocal = leerConfiguracion({
      ...variables,
      // Valores locales ficticios para comprobar que el mismo ejemplo permite activar Mailpit.
      // secretlint-disable-next-line
      DATABASE_URL: 'postgres://supera:prueba@db:5432/supera_paes',
      JWT_SECRETO_CONSOLA: SECRETO_DE_PRUEBA,
      JWT_SECRETO_APP: SECRETO_APP_DE_PRUEBA,
      CLAVE_CODIGO_CORREO: CLAVE_CODIGO_DE_PRUEBA,
      PROVEEDOR_CORREO: 'smtp',
      SMTP_HOST: 'localhost',
      SMTP_PORT: '1025',
      SMTP_TLS: 'none',
      CORREO_REMITENTE: 'no-responder@ejemplo.cl',
    });
    expect(smtpLocal.correo).toMatchObject({ proveedor: 'smtp', tls: 'none' });
  });
});
