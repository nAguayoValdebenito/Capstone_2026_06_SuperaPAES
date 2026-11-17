// Datos de las pruebas de la pasarela de la App Store (HU-43.1). Las respuestas siguen la forma
// documentada de la App Store Server API (Get All Subscription Statuses, JWSTransaction y
// JWSRenewalInfo). La cadena de certificados (raíz, intermedio con el OID de Apple 1.2.840.113635.100.6.2.1
// y hoja con 1.2.840.113635.100.6.11.1) y todas las llaves se generan en memoria al cargar las pruebas:
// ninguna llave queda en el repositorio y la raíz de prueba no es la de Apple.
import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { CompactSign } from 'jose';
import jsrsasign from 'jsrsasign';
import { PasarelaAppStore } from '../adaptadores/pagos/app-store.js';
import { httpFalso, type RespuestaFalsa } from './http-falso.js';

export const BUNDLE = 'cl.superapaes.app';
export const ID_TRANSACCION = '2000000123';
export const ID_ORIGINAL = '2000000100';
export const CUENTA = '4ea3b5d0-1c2e-8f00-9a1b-2c3d4e5f6a7b';
export const URL_ESTADOS = `https://api.storekit-sandbox.itunes.apple.com/inApps/v1/subscriptions/${ID_TRANSACCION}`;
export const AHORA = new Date('2027-03-15T12:00:00.000Z');
const DIA = 86_400_000;

interface Par {
  privada: KeyObject;
  privadaPem: string;
  publicaPem: string;
}

function parEc(): Par {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    privada: privateKey,
    privadaPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicaPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

const der = (pem: string) => Buffer.from(pem.replace(/-----[^-]+-----|\s/g, ''), 'base64');

interface DatosCertificado {
  serie: number;
  emisor: string;
  sujeto: string;
  llave: Par;
  firmante: Par;
  extensiones: object[];
}

function certificado(d: DatosCertificado): string {
  return new jsrsasign.KJUR.asn1.x509.Certificate({
    version: 3,
    serial: { int: d.serie },
    issuer: { str: `/CN=${d.emisor}` },
    subject: { str: `/CN=${d.sujeto}` },
    notbefore: '260101000000Z',
    notafter: '300101000000Z',
    sbjpubkey: d.llave.publicaPem,
    ext: d.extensiones,
    sigalg: 'SHA256withECDSA',
    cakey: d.firmante.privadaPem,
  } as never).getPEM();
}

const CA = { extname: 'basicConstraints', cA: true, critical: true };
const OID_INTERMEDIO = { extname: '1.2.840.113635.100.6.2.1', extn: '0500' };
const OID_HOJA = { extname: '1.2.840.113635.100.6.11.1', extn: '0500' };

/** Una cadena raíz → intermedio → hoja, como la de Apple pero generada aquí. */
export function crearCadena(hojaConOid = true) {
  const raiz = parEc();
  const intermedio = parEc();
  const hoja = parEc();
  const RAIZ = 'Raiz de prueba';
  const INTERMEDIO = 'Intermedio de prueba';
  const raizPem = certificado({
    serie: 1,
    emisor: RAIZ,
    sujeto: RAIZ,
    llave: raiz,
    firmante: raiz,
    extensiones: [CA],
  });
  const intermedioPem = certificado({
    serie: 2,
    emisor: RAIZ,
    sujeto: INTERMEDIO,
    llave: intermedio,
    firmante: raiz,
    extensiones: [CA, OID_INTERMEDIO],
  });
  const hojaPem = certificado({
    serie: 3,
    emisor: INTERMEDIO,
    sujeto: 'Hoja de prueba',
    llave: hoja,
    firmante: intermedio,
    extensiones: hojaConOid ? [OID_HOJA] : [],
  });
  return {
    raiz: der(raizPem),
    x5c: [hojaPem, intermedioPem, raizPem].map((pem) => der(pem).toString('base64')),
    llaveHoja: hoja.privada,
  };
}

export const cadena = crearCadena();
export const claveApi = parEc();

/** JWS firmado por la hoja de la cadena, con la cadena en x5c. */
export function firmar(datos: object, con: ReturnType<typeof crearCadena> = cadena) {
  return new CompactSign(new TextEncoder().encode(JSON.stringify(datos)))
    .setProtectedHeader({ alg: 'ES256', x5c: con.x5c })
    .sign(con.llaveHoja);
}

/** JWSTransactionDecodedPayload de la documentación, con lo que cambia cada caso. */
export function transaccion(cambios: Record<string, unknown> = {}) {
  return {
    transactionId: ID_TRANSACCION,
    originalTransactionId: ID_ORIGINAL,
    webOrderLineItemId: '2000000050',
    bundleId: BUNDLE,
    productId: 'todas_mensual',
    subscriptionGroupIdentifier: '21000000',
    purchaseDate: AHORA.getTime() - 60_000,
    originalPurchaseDate: AHORA.getTime() - 60_000,
    expiresDate: AHORA.getTime() + 30 * DIA,
    quantity: 1,
    type: 'Auto-Renewable Subscription',
    appAccountToken: CUENTA,
    inAppOwnershipType: 'PURCHASED',
    signedDate: AHORA.getTime(),
    environment: 'Sandbox',
    transactionReason: 'PURCHASE',
    storefront: 'CHL',
    storefrontId: '143483',
    price: 2990000,
    currency: 'CLP',
    ...cambios,
  };
}

/** JWSRenewalInfoDecodedPayload de la documentación. */
export function renovacion(cambios: Record<string, unknown> = {}) {
  return {
    originalTransactionId: ID_ORIGINAL,
    autoRenewProductId: 'todas_mensual',
    productId: 'todas_mensual',
    autoRenewStatus: 1,
    signedDate: AHORA.getTime(),
    environment: 'Sandbox',
    recentSubscriptionStartDate: AHORA.getTime() - 60_000,
    renewalDate: AHORA.getTime() + 30 * DIA,
    ...cambios,
  };
}

/** StatusResponse con una suscripción del grupo y su estado (1 activa, 2 vencida, 5 revocada…). */
export async function estados(
  estado = 1,
  datos: { transaccion?: object; renovacion?: object; firmaTransaccion?: string } = {},
) {
  return {
    environment: 'Sandbox',
    bundleId: BUNDLE,
    data: [
      {
        subscriptionGroupIdentifier: '21000000',
        lastTransactions: [
          {
            originalTransactionId: ID_ORIGINAL,
            status: estado,
            signedTransactionInfo:
              datos.firmaTransaccion ?? (await firmar(datos.transaccion ?? transaccion())),
            signedRenewalInfo: await firmar(datos.renovacion ?? renovacion()),
          },
        ],
      },
    ],
  };
}

export const configuracion = {
  bundleId: BUNDLE,
  idEmisor: '57246542-96fe-1a63-e053-0824d011072a',
  idClave: 'ABCDEFGHIJ',
  clavePrivada: claveApi.privadaPem,
  entorno: 'sandbox' as const,
};

/** La pasarela con el cliente HTTP falso, la raíz de prueba y sin consultas OCSP. */
export function pasarela(
  respuestas: Record<string, RespuestaFalsa | RespuestaFalsa[]>,
  cambios: Partial<typeof configuracion> | { entorno: 'produccion' } = {},
) {
  const falso = httpFalso(respuestas);
  const appStore = new PasarelaAppStore(
    { ...configuracion, ...cambios },
    {
      http: falso.cliente,
      reloj: () => AHORA,
      certificadosRaiz: [cadena.raiz],
      verificacionEnLinea: false,
    },
  );
  return { appStore, peticiones: falso.peticiones };
}
