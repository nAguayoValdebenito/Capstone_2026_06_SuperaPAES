import { describe, expect, it } from 'vitest';
import { leerConfiguracion } from '../comun/configuracion.js';
import { variablesMinimas } from './variables-configuracion.js';

// Variables de despliegue comunes: 24 contando NODE_ENV y el selector PROVEEDOR_IA.
const comunes = {
  ...variablesMinimas,
  NODE_ENV: 'production',
  URL_CONSOLA: 'https://consola.ejemplo.cl',
  CORS_ORIGENES: 'https://consola.ejemplo.cl',
  PROVEEDOR_IA: 'deepseek',
  PROVEEDOR_CORREO: 'smtp',
  SMTP_HOST: 'smtp.ejemplo.cl',
  SMTP_PORT: '2525',
  SMTP_TLS: 'starttls',
  SMTP_USUARIO: 'usuario-ficticio',
  SMTP_CLAVE: 'clave-ficticia',
  CORREO_REMITENTE: 'no-responder@ejemplo.cl',
  PROVEEDOR_PAGOS: 'tiendas',
  GOOGLE_PLAY_PAQUETE: 'cl.ejemplo.app',
  GOOGLE_PLAY_CUENTA_SERVICIO: '/secretos/ficticios.json',
  GOOGLE_PLAY_PUBSUB_AUDIENCIA: 'https://api.ejemplo.cl/google-play',
  APP_STORE_BUNDLE_ID: 'cl.ejemplo.app',
  APP_STORE_ID_EMISOR: 'ficticio',
  APP_STORE_ID_CLAVE: 'ficticia',
  APP_STORE_CLAVE_PRIVADA: 'ficticia',
  APP_STORE_ENTORNO: 'sandbox',
};

describe('conteo de variables efectivas de producción según la IA', () => {
  it.each([
    [25, { DEEPSEEK_API_KEY: 'ficticia' }],
    [
      27,
      { DEEPSEEK_API_KEY: 'ficticia', GEMINI_API_KEY: 'respaldo', GEMINI_MODELO: 'modelo-prueba' },
    ],
    [26, { PROVEEDOR_IA: 'gemini', GEMINI_API_KEY: 'ficticia', GEMINI_MODELO: 'modelo-prueba' }],
  ])('%i variables configuran un despliegue válido', (cantidad, ia) => {
    const variables = { ...comunes, ...ia };
    expect(Object.keys(variables)).toHaveLength(cantidad);
    expect(() => leerConfiguracion(variables)).not.toThrow();
    for (const nombre of Object.keys(variables).filter((clave) => clave !== 'NODE_ENV')) {
      if (variables.PROVEEDOR_IA === 'deepseek' && nombre === 'GEMINI_API_KEY') {
        expect(
          leerConfiguracion({ ...variables, GEMINI_API_KEY: undefined }).ia,
        ).not.toHaveProperty('respaldo');
        continue;
      }
      expect(() => leerConfiguracion({ ...variables, [nombre]: undefined }), nombre).toThrow();
    }
  });
});
