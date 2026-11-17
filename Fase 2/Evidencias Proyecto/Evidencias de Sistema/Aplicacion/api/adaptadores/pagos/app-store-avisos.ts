// Avisos de la App Store (HU-44.1, DAS 4.3.3): App Store Server Notifications V2, firmadas en JWS, que
// Apple envía a /api/v1/webhooks/app-store. La firma la verifica SignedDataVerifier (en app-store.ts);
// aquí se lee el cuerpo, se traduce la notificación ya verificada y se traduce el estado de Get All
// Subscription Statuses al de la tienda (SuscripcionEnTienda). Nada de la firma, de la compra ni de la
// notificación llega a los registros ni a los errores.
import {
  VerificationException,
  VerificationStatus,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library';
import { z } from 'zod';
import { ErrorCompraNoValida, ErrorSolicitudInvalida } from '../../comun/errores.js';
import type { AvisoEntrante, AvisoVerificado, SuscripcionEnTienda } from './pasarela.js';
import { noDisponible } from './respuestas-tienda.js';

const esquemaCuerpo = z.object({ signedPayload: z.string().min(1) });

/** Tipos que informan un reembolso o una revocación: la suscripción termina ahora. */
const REEMBOLSOS = new Set(['REFUND', 'REVOKE']);

/** expirationIntent de JWSRenewalInfo: 2 es un error de cobro. */
const INTENTO_COBRO = 2;

/** El signedPayload del cuerpo; uno mal formado se rechaza (400) sin mostrar su contenido. */
export function signedPayloadDe(aviso: AvisoEntrante): string {
  try {
    return esquemaCuerpo.parse(JSON.parse(aviso.cuerpoCrudo.toString('utf8'))).signedPayload;
  } catch {
    throw new ErrorSolicitudInvalida('El aviso de la App Store no tiene el formato esperado.');
  }
}

/**
 * Firma no comprobada, cadena ajena, otra app u otro entorno: el aviso no viene de Apple (400, no se
 * registra). Si no se pudo comprobar la revocación de la cadena, la tienda queda no disponible (503) y
 * Apple reintenta.
 */
export async function verificadoPorApple<T>(verificacion: () => Promise<T>): Promise<T> {
  try {
    return await verificacion();
  } catch (error) {
    if (!(error instanceof VerificationException)) throw error;
    if (error.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE)
      throw noDisponible('app_store', 'no se pudo comprobar la revocación de la cadena');
    throw new ErrorSolicitudInvalida('El aviso no viene de la App Store.');
  }
}

/** La notificación verificada, con la transacción verificada que trae (si trae). */
export function avisoDeApple(
  notificacion: ResponseBodyV2DecodedPayload,
  transaccion: JWSTransactionDecodedPayload | null,
): AvisoVerificado {
  const { notificationType: tipo, subtype, notificationUUID } = notificacion;
  if (!notificationUUID || !tipo)
    throw new ErrorSolicitudInvalida('El aviso de la App Store no tiene el formato esperado.');
  return {
    tienda: 'app_store',
    idEvento: notificationUUID,
    tipo: subtype ? `${tipo}/${subtype}` : tipo,
    idCompraTienda: transaccion?.originalTransactionId ?? null,
    ...(REEMBOLSOS.has(tipo) ? { reembolso: true } : {}),
  };
}

/**
 * Estado de Apple → estado en la tienda (decisiones del 03/11/2026): 1 activa; 3 (reintento de cobro) y
 * 4 (período de gracia) en mora; 2 vencida, terminada por cobro si su intención de vencimiento es un
 * error de cobro y, si no, porque no renovó; 5 o una fecha de revocación, terminada por reembolso.
 */
function estadoDe(
  estado: number,
  transaccion: JWSTransactionDecodedPayload,
  renovacion: JWSRenewalInfoDecodedPayload | null,
): Pick<SuscripcionEnTienda, 'estado' | 'fin'> {
  if (estado === 5 || transaccion.revocationDate !== undefined)
    return { estado: 'terminada', fin: 'reembolso' };
  if (estado === 1) return { estado: 'activa', fin: null };
  if (estado === 3 || estado === 4) return { estado: 'en_mora', fin: null };
  if (estado === 2) {
    const porCobro = Number(renovacion?.expirationIntent) === INTENTO_COBRO;
    return { estado: 'terminada', fin: porCobro ? 'cobro' : 'no_renovo' };
  }
  throw new ErrorCompraNoValida('no_vigente');
}

const fecha = (milisegundos: number | undefined) =>
  milisegundos === undefined ? null : new Date(milisegundos);

/**
 * La suscripción como la informa la App Store tras un aviso (HU-44.1). Una subida de plan cambia el
 * producto de la transacción y rige de inmediato; una bajada solo cambia el de la renovación y rige
 * desde la siguiente renovación (CU-12 1.b), cuando llega su DID_RENEW.
 */
export function suscripcionEnTiendaDeApple(
  idCompraTienda: string,
  estado: number,
  transaccion: JWSTransactionDecodedPayload,
  renovacion: JWSRenewalInfoDecodedPayload | null,
): SuscripcionEnTienda {
  if (!transaccion.productId) throw new ErrorCompraNoValida('no_encontrada');
  const { estado: enTienda, fin } = estadoDe(estado, transaccion, renovacion);
  return {
    idCompraTienda,
    estado: enTienda,
    fin,
    idProducto: transaccion.productId,
    cuentaTienda: transaccion.appAccountToken ?? null,
    periodoInicio: fecha(transaccion.purchaseDate),
    periodoFin: fecha(transaccion.expiresDate),
    idPagoPasarela: enTienda === 'activa' ? (transaccion.transactionId ?? null) : null,
    renovacionAutomatica: Number(renovacion?.autoRenewStatus) === 1,
  };
}
