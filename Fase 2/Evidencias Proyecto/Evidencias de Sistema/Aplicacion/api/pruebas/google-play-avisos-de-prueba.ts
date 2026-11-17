// Datos de las pruebas de los avisos de Google Play (HU-44.1). El envío sigue la forma documentada de
// Cloud Pub/Sub (push con token OIDC) y de las notificaciones en tiempo real para desarrolladores. Las
// llaves que firman el token se generan en memoria al cargar las pruebas, como si fueran las de Google:
// ninguna llave queda en el repositorio y nada llama a Google.
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { PasarelaGooglePlay } from '../adaptadores/pagos/google-play.js';
import type { AvisoEntrante } from '../adaptadores/pagos/pasarela.js';
import {
  AHORA,
  cuentaServicio,
  PAQUETE,
  tokenDeAcceso,
  URL_TOKEN,
} from './google-play-de-prueba.js';
import { httpFalso, type RespuestaFalsa } from './http-falso.js';

export const AUDIENCIA = 'https://api.superapaes.cl/api/v1/webhooks/google-play';
export const ID_MENSAJE = '4567890123456789';

const ID_LLAVE = 'llave-de-prueba';
const google = await generateKeyPair('RS256');
const ajena = await generateKeyPair('RS256');
const publica = { ...(await exportJWK(google.publicKey)), kid: ID_LLAVE, alg: 'RS256' };

/** Las llaves públicas «de Google» que usa la pasarela en las pruebas. */
export const llavesPubSub = createLocalJWKSet({ keys: [publica] });

const segundos = (fecha: Date) => Math.floor(fecha.getTime() / 1000);

/** Token OIDC del push de Pub/Sub, firmado como Google, con lo que cambia cada caso. */
export function tokenPubSub(
  cambios: {
    claims?: JWTPayload;
    audiencia?: string;
    emisor?: string;
    llaveAjena?: boolean;
    vencido?: boolean;
  } = {},
) {
  const ahora = segundos(AHORA);
  return new SignJWT({
    email: 'pubsub@supera-paes.iam.gserviceaccount.com',
    email_verified: true,
    ...cambios.claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: ID_LLAVE, typ: 'JWT' })
    .setIssuer(cambios.emisor ?? 'https://accounts.google.com')
    .setAudience(cambios.audiencia ?? AUDIENCIA)
    .setIssuedAt(cambios.vencido ? ahora - 7200 : ahora - 60)
    .setExpirationTime(cambios.vencido ? ahora - 3600 : ahora + 3600)
    .sign(cambios.llaveAjena ? ajena.privateKey : google.privateKey);
}

/** Una DeveloperNotification de una suscripción (renovación, salvo otro tipo). */
export const notificacionDeSuscripcion = (
  tipo = 2,
  token = 'token-de-compra-de-prueba.AO-J1Oz',
) => ({
  version: '1.0',
  packageName: PAQUETE,
  eventTimeMillis: String(AHORA.getTime()),
  subscriptionNotification: { version: '1.0', notificationType: tipo, purchaseToken: token },
});

/** El envío de Pub/Sub con la notificación en base64, con el token dado (o sin token). */
export function envio(notificacion: unknown, token?: string, id = ID_MENSAJE): AvisoEntrante {
  const cuerpo = {
    message: {
      data: Buffer.from(JSON.stringify(notificacion)).toString('base64'),
      messageId: id,
      publishTime: AHORA.toISOString(),
    },
    subscription: 'projects/supera-paes/subscriptions/avisos-play',
  };
  return {
    cuerpoCrudo: Buffer.from(JSON.stringify(cuerpo)),
    encabezados: token === undefined ? {} : { authorization: `Bearer ${token}` },
  };
}

/** La pasarela de Google con las llaves de prueba y el cliente HTTP falso. */
export function pasarelaConAvisos(
  respuestas: Record<string, RespuestaFalsa | RespuestaFalsa[]> = {},
) {
  const falso = httpFalso({ [URL_TOKEN]: tokenDeAcceso, ...respuestas });
  return new PasarelaGooglePlay(
    { paquete: PAQUETE, cuentaServicio, audienciaPubSub: AUDIENCIA },
    { http: falso.cliente, reloj: () => AHORA, llavesPubSub },
  );
}
