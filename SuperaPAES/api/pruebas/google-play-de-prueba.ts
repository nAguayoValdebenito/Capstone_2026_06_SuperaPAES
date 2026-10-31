// Datos de las pruebas de la pasarela de Google Play (HU-43.1). Las respuestas siguen la forma
// documentada de la Google Play Developer API (purchases.subscriptionsv2.get) y del token de la cuenta
// de servicio (OAuth 2.0 con JWT). La llave de la cuenta de servicio se genera en memoria al cargar
// las pruebas: ninguna llave queda en el repositorio.
import { generateKeyPairSync } from 'node:crypto';
import { PasarelaGooglePlay } from '../adaptadores/pagos/google-play.js';
import { httpFalso, type RespuestaFalsa } from './http-falso.js';

export const PAQUETE = 'cl.superapaes.app';
export const TOKEN_COMPRA = 'token-de-compra-de-prueba.AO-J1Oz';
export const CUENTA = '4ea3b5d0-1c2e-8f00-9a1b-2c3d4e5f6a7b';
export const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PAQUETE}/purchases`;
export const URL_COMPRA = `${API}/subscriptionsv2/tokens/${encodeURIComponent(TOKEN_COMPRA)}`;
export const URL_CONFIRMAR = `${API}/subscriptions/todas_mensual/tokens/${encodeURIComponent(TOKEN_COMPRA)}:acknowledge`;
export const AHORA = new Date('2027-03-15T12:00:00.000Z');

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
export const llavePublica = publicKey.export({ type: 'spki', format: 'pem' }).toString();
export const CORREO_SERVICIO = 'validador@supera-paes.iam.gserviceaccount.com';
export const cuentaServicio = JSON.stringify({
  type: 'service_account',
  client_email: CORREO_SERVICIO,
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  token_uri: URL_TOKEN,
});

export /** SubscriptionPurchaseV2 de la documentación, con lo que cambia cada caso. */
function compraDeGoogle(
  cambios: Record<string, unknown> = {},
  linea: Record<string, unknown> = {},
) {
  return {
    kind: 'androidpublisher#subscriptionPurchaseV2',
    regionCode: 'CL',
    startTime: '2027-03-15T11:59:00.000Z',
    subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
    latestOrderId: 'GPA.3300-0000-0000-00000',
    acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
    externalAccountIdentifiers: { obfuscatedExternalAccountId: CUENTA },
    testPurchase: {},
    lineItems: [
      {
        productId: 'todas_mensual',
        expiryTime: '2027-04-15T11:59:00.000Z',
        autoRenewingPlan: { autoRenewEnabled: true },
        offerDetails: { basePlanId: 'mensual' },
        latestSuccessfulOrderId: 'GPA.3300-0000-0000-00001',
        ...linea,
      },
    ],
    ...cambios,
  };
}
export const tokenDeAcceso = {
  estado: 200,
  cuerpo: { access_token: 'acceso-1', expires_in: 3599 },
};

/** La pasarela con el cliente HTTP falso, que entrega el token de acceso y las respuestas dadas. */
export function pasarela(
  respuestas: Record<string, RespuestaFalsa | RespuestaFalsa[]>,
  opciones: { cuenta?: string; reloj?: () => Date } = {},
) {
  const falso = httpFalso({ [URL_TOKEN]: tokenDeAcceso, ...respuestas });
  const google = new PasarelaGooglePlay(
    { paquete: PAQUETE, cuentaServicio: opciones.cuenta ?? cuentaServicio, audienciaPubSub: 'aud' },
    { http: falso.cliente, reloj: opciones.reloj ?? (() => AHORA) },
  );
  return { google, peticiones: falso.peticiones };
}
