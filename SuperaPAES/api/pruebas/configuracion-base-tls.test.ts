// En producción la conexión a la base exige TLS (DATABASE_SSL=true): sin él, los hashes, los tokens y
// los datos personales viajan legibles hasta PostgreSQL. Fuera de producción puede quedar en false.
import { describe, expect, it } from 'vitest';
import { leerConfiguracion } from '../comun/configuracion.js';
import { variablesMinimas as minimas } from './variables-configuracion.js';

/** Un despliegue de producción válido, salvo DATABASE_SSL. */
const produccion = {
  ...minimas,
  NODE_ENV: 'production',
  DATABASE_SSL: 'true',
  URL_CONSOLA: 'https://consola.superapaes.cl',
  CORS_ORIGENES: 'https://consola.superapaes.cl',
  PROVEEDOR_CORREO: 'smtp',
  SMTP_HOST: 'smtp.ejemplo.cl',
  SMTP_PORT: '2525',
  SMTP_TLS: 'starttls',
  SMTP_USUARIO: 'usuario-smtp',
  SMTP_CLAVE: 'clave-smtp-de-prueba',
  CORREO_REMITENTE: 'no-responder@ejemplo.cl',
  PROVEEDOR_IA: 'deepseek',
  DEEPSEEK_API_KEY: 'clave',
  PROVEEDOR_PAGOS: 'tiendas',
  GOOGLE_PLAY_PAQUETE: 'cl.superapaes.app',
  GOOGLE_PLAY_CUENTA_SERVICIO: '/secretos/cuenta-servicio.json',
  GOOGLE_PLAY_PUBSUB_AUDIENCIA: 'https://api.superapaes.cl/api/v1/webhooks/google-play',
  APP_STORE_BUNDLE_ID: 'cl.superapaes.app',
  APP_STORE_ID_EMISOR: 'emisor',
  APP_STORE_ID_CLAVE: 'ABC123',
  APP_STORE_CLAVE_PRIVADA: '-----BEGIN PRIVATE KEY-----',
  APP_STORE_ENTORNO: 'sandbox',
};

describe('TLS de la base en producción', () => {
  it('con DATABASE_SSL=true arranca y la base se conecta con TLS', () => {
    expect(leerConfiguracion(produccion).baseDeDatos.ssl).toBe(true);
  });

  it.each([['false'], [undefined]])('rechaza DATABASE_SSL=%s', (valor) => {
    expect(() => leerConfiguracion({ ...produccion, DATABASE_SSL: valor })).toThrow(
      /DATABASE_SSL[\s\S]*debe ser true/,
    );
  });

  it('fuera de producción DATABASE_SSL puede quedar en false', () => {
    const desarrollo = { ...minimas, DATABASE_SSL: 'false' };

    expect(leerConfiguracion(desarrollo).baseDeDatos.ssl).toBe(false);
  });
});
