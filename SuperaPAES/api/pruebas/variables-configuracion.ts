import {
  CLAVE_CODIGO_DE_PRUEBA,
  SECRETO_APP_DE_PRUEBA,
  SECRETO_DE_PRUEBA,
  URL_CONSOLA_DE_PRUEBA,
} from './ayudantes.js';

export const variablesMinimas = {
  // Valor ficticio, no es un secreto. secretlint-disable-next-line
  DATABASE_URL: 'postgres://usuario:clave@localhost:5432/supera_paes',
  JWT_SECRETO_CONSOLA: SECRETO_DE_PRUEBA,
  JWT_SECRETO_APP: SECRETO_APP_DE_PRUEBA,
  URL_CONSOLA: URL_CONSOLA_DE_PRUEBA,
  CORS_ORIGENES: URL_CONSOLA_DE_PRUEBA,
  CLAVE_CODIGO_CORREO: CLAVE_CODIGO_DE_PRUEBA,
};

/** Variables de PROVEEDOR_PAGOS=tiendas, todas con valores ficticios. */
export const variablesTiendas = {
  PROVEEDOR_PAGOS: 'tiendas',
  GOOGLE_PLAY_PAQUETE: 'cl.superapaes.app',
  GOOGLE_PLAY_CUENTA_SERVICIO: '/secretos/cuenta-servicio.json',
  GOOGLE_PLAY_PUBSUB_AUDIENCIA: 'https://api.superapaes.cl/api/v1/webhooks/google-play',
  GOOGLE_PLAY_PUBSUB_CORREO: 'pubsub@ejemplo-ficticio.iam.gserviceaccount.com',
  APP_STORE_BUNDLE_ID: 'cl.superapaes.app',
  APP_STORE_ID_EMISOR: 'emisor',
  APP_STORE_ID_CLAVE: 'ABC123',
  APP_STORE_CLAVE_PRIVADA: '-----BEGIN PRIVATE KEY-----',
  APP_STORE_ENTORNO: 'sandbox',
};
