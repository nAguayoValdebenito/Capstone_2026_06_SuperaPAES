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
