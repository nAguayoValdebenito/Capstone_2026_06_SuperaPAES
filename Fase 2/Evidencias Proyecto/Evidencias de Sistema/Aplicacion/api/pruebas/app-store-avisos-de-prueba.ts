// Datos de las pruebas de los avisos de la App Store (HU-44.1). La notificación sigue la forma documentada
// de App Store Server Notifications V2 (ResponseBodyV2DecodedPayload) y se firma con la cadena de prueba de
// app-store-de-prueba.ts, generada en memoria: no es la de Apple y ninguna llave queda en el repositorio.
import type { AvisoEntrante } from '../adaptadores/pagos/pasarela.js';
import type { cadena } from './app-store-de-prueba.js';
import {
  AHORA,
  BUNDLE,
  firmar,
  ID_ORIGINAL,
  renovacion,
  transaccion,
} from './app-store-de-prueba.js';

export const URL_ESTADOS_ORIGINAL = `https://api.storekit-sandbox.itunes.apple.com/inApps/v1/subscriptions/${ID_ORIGINAL}`;

let siguiente = 0;

interface Notificacion {
  tipo: string;
  subtipo?: string;
  id?: string;
  /** Sin transacción, como el aviso TEST. */
  sinTransaccion?: boolean;
  transaccion?: object;
  bundle?: string;
  conCadena?: typeof cadena;
}

/** El cuerpo que Apple envía a la ruta: { signedPayload } con la notificación firmada. */
export async function avisoApple(n: Notificacion): Promise<AvisoEntrante & { id: string }> {
  const id = n.id ?? `00000000-0000-4000-8000-${String(++siguiente).padStart(12, '0')}`;
  const datos = {
    appAppleId: undefined,
    bundleId: n.bundle ?? BUNDLE,
    environment: 'Sandbox',
    ...(n.sinTransaccion
      ? {}
      : {
          signedTransactionInfo: await firmar(n.transaccion ?? transaccion(), n.conCadena),
          signedRenewalInfo: await firmar(renovacion(), n.conCadena),
          status: 1,
        }),
  };
  const notificacion = {
    notificationType: n.tipo,
    ...(n.subtipo ? { subtype: n.subtipo } : {}),
    notificationUUID: id,
    data: datos,
    version: '2.0',
    signedDate: AHORA.getTime(),
  };
  const signedPayload = await firmar(notificacion, n.conCadena);
  return { id, cuerpoCrudo: Buffer.from(JSON.stringify({ signedPayload })), encabezados: {} };
}
