// Avisos de Google Play (HU-44.1, DAS 4.3.3): notificaciones en tiempo real para desarrolladores que
// Cloud Pub/Sub envía a /api/v1/webhooks/google-play. Se verifica el token OIDC del envío con las llaves
// públicas de Google (jose), su emisor, su audiencia (GOOGLE_PLAY_PUBSUB_AUDIENCIA) y el correo
// verificado; después se lee el mensaje y se comprueba que sea de esta app. También traduce el estado de
// purchases.subscriptionsv2 al de la tienda (SuscripcionEnTienda). Nada del token, de la compra ni del
// mensaje llega a los registros ni a los errores.
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';
import {
  ErrorCompraNoValida,
  ErrorNoAutenticado,
  ErrorSolicitudInvalida,
} from '../../comun/errores.js';
import type { AvisoEntrante, AvisoVerificado, SuscripcionEnTienda } from './pasarela.js';

const LLAVES_GOOGLE = 'https://www.googleapis.com/oauth2/v3/certs';
const EMISORES = ['https://accounts.google.com', 'accounts.google.com'];

/** Llaves públicas de Google, que jose descarga y guarda en memoria; las pruebas pasan las suyas. */
export const llavesDeGoogle = (): JWTVerifyGetKey => createRemoteJWKSet(new URL(LLAVES_GOOGLE));

/** SubscriptionPurchaseV2: solo los campos que se usan. */
export const esquemaCompra = z.object({
  subscriptionState: z.string().default('SUBSCRIPTION_STATE_UNSPECIFIED'),
  latestOrderId: z.string().optional(),
  acknowledgementState: z.string().optional(),
  externalAccountIdentifiers: z
    .object({ obfuscatedExternalAccountId: z.string().optional() })
    .optional(),
  canceledStateContext: z
    .object({
      userInitiatedCancellation: z.unknown().optional(),
      systemInitiatedCancellation: z.unknown().optional(),
      developerInitiatedCancellation: z.unknown().optional(),
    })
    .optional(),
  lineItems: z
    .array(
      z.object({
        productId: z.string().min(1),
        expiryTime: z.string().optional(),
        latestSuccessfulOrderId: z.string().optional(),
        autoRenewingPlan: z.object({ autoRenewEnabled: z.boolean().optional() }).optional(),
      }),
    )
    .default([]),
});

export type CompraDeGoogle = z.infer<typeof esquemaCompra>;

/** El envío de Pub/Sub: el mensaje lleva la notificación en base64. */
const esquemaEnvio = z.object({
  message: z.object({ data: z.string().min(1), messageId: z.string().min(1).max(100) }),
});

const esquemaNotificacion = z.object({
  packageName: z.string(),
  subscriptionNotification: z
    .object({ notificationType: z.number().int(), purchaseToken: z.string().min(1) })
    .optional(),
  voidedPurchaseNotification: z
    .object({ purchaseToken: z.string().min(1), productType: z.number().int().optional() })
    .optional(),
  testNotification: z.object({}).loose().optional(),
});

/** Nombres de subscriptionNotification.notificationType (documentación de RTDN). */
const TIPOS: Record<number, string> = {
  1: 'SUBSCRIPTION_RECOVERED',
  2: 'SUBSCRIPTION_RENEWED',
  3: 'SUBSCRIPTION_CANCELED',
  4: 'SUBSCRIPTION_PURCHASED',
  5: 'SUBSCRIPTION_ON_HOLD',
  6: 'SUBSCRIPTION_IN_GRACE_PERIOD',
  7: 'SUBSCRIPTION_RESTARTED',
  8: 'SUBSCRIPTION_PRICE_CHANGE_CONFIRMED',
  9: 'SUBSCRIPTION_DEFERRED',
  10: 'SUBSCRIPTION_PAUSED',
  11: 'SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED',
  12: 'SUBSCRIPTION_REVOKED',
  13: 'SUBSCRIPTION_EXPIRED',
  17: 'SUBSCRIPTION_ITEMS_CHANGED',
  18: 'SUBSCRIPTION_CANCELLATION_SCHEDULED',
  19: 'SUBSCRIPTION_PRICE_CHANGE_UPDATED',
  20: 'SUBSCRIPTION_PENDING_PURCHASE_CANCELED',
};
const REVOCADA = 12;
/** voidedPurchaseNotification.productType de una suscripción (2 es un producto de una vez). */
const PRODUCTO_SUSCRIPCION = 1;

export interface OpcionesAvisoGoogle {
  audiencia: string;
  paquete: string;
  llaves: JWTVerifyGetKey;
  ahora: Date;
}

/** El token OIDC del envío: firmado por Google, para esta audiencia y con el correo verificado. */
async function verificarToken(aviso: AvisoEntrante, opciones: OpcionesAvisoGoogle) {
  const encabezado = aviso.encabezados['authorization'];
  const token = typeof encabezado === 'string' ? /^Bearer (\S+)$/.exec(encabezado)?.[1] : undefined;
  if (!token) throw new ErrorNoAutenticado('El aviso no trae el token de Google.');
  try {
    const { payload } = await jwtVerify(token, opciones.llaves, {
      issuer: EMISORES,
      audience: opciones.audiencia,
      algorithms: ['RS256'],
      currentDate: opciones.ahora,
    });
    if (payload['email_verified'] !== true) throw new Error('correo sin verificar');
  } catch {
    throw new ErrorNoAutenticado('El aviso no viene de Google Play.');
  }
}

/** El mensaje de Pub/Sub con su notificación; uno mal formado o de otra app se rechaza (400). */
function leerMensaje(aviso: AvisoEntrante, paquete: string) {
  try {
    const envio = esquemaEnvio.parse(JSON.parse(aviso.cuerpoCrudo.toString('utf8')));
    const datos = Buffer.from(envio.message.data, 'base64').toString('utf8');
    const notificacion = esquemaNotificacion.parse(JSON.parse(datos));
    if (notificacion.packageName === paquete) return { envio, notificacion };
  } catch {
    // Se informa abajo, sin el contenido.
  }
  throw new ErrorSolicitudInvalida('El aviso de Google Play no tiene el formato esperado.');
}

/** Verifica el envío de Pub/Sub y traduce su notificación (HU-44.1). */
export async function verificarAvisoGoogle(
  aviso: AvisoEntrante,
  opciones: OpcionesAvisoGoogle,
): Promise<AvisoVerificado> {
  await verificarToken(aviso, opciones);
  const { envio, notificacion } = leerMensaje(aviso, opciones.paquete);
  const base = { tienda: 'google_play' as const, idEvento: envio.message.messageId };
  const suscripcion = notificacion.subscriptionNotification;
  if (suscripcion) {
    const { notificationType: tipo, purchaseToken } = suscripcion;
    return {
      ...base,
      tipo: TIPOS[tipo] ?? `SUBSCRIPTION_${String(tipo)}`,
      idCompraTienda: purchaseToken,
      ...(tipo === REVOCADA ? { reembolso: true } : {}),
    };
  }
  const anulada = notificacion.voidedPurchaseNotification;
  if (anulada?.productType === PRODUCTO_SUSCRIPCION)
    return {
      ...base,
      tipo: 'VOIDED_PURCHASE',
      idCompraTienda: anulada.purchaseToken,
      reembolso: true,
    };
  const tipo = notificacion.testNotification ? 'TEST_NOTIFICATION' : 'OTRO';
  return { ...base, tipo, idCompraTienda: null };
}

/** Por qué terminó, según canceledStateContext: el sistema (cobro), el desarrollador o el estudiante. */
function finDe(compra: CompraDeGoogle): SuscripcionEnTienda['fin'] {
  const contexto = compra.canceledStateContext;
  if (contexto?.systemInitiatedCancellation !== undefined) return 'cobro';
  if (contexto?.developerInitiatedCancellation !== undefined) return 'reembolso';
  return 'no_renovo';
}

/**
 * Estado de Google → estado en la tienda (decisiones del 03/11/2026): período de gracia y retención de
 * cuenta (ON_HOLD) quedan en mora; CANCELED sigue activa hasta el fin del período pagado; PAUSED y el
 * estado sin especificar no se atienden (la app no ofrece pausar): COMPRA_NO_VALIDA no_vigente.
 */
function estadoDe(compra: CompraDeGoogle, fin: Date | null, ahora: Date) {
  const terminada = { estado: 'terminada' as const, fin: finDe(compra) };
  switch (compra.subscriptionState) {
    case 'SUBSCRIPTION_STATE_ACTIVE':
      return { estado: 'activa' as const, fin: null };
    case 'SUBSCRIPTION_STATE_CANCELED':
      return fin !== null && fin > ahora ? { estado: 'activa' as const, fin: null } : terminada;
    case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD':
    case 'SUBSCRIPTION_STATE_ON_HOLD':
      return { estado: 'en_mora' as const, fin: null };
    case 'SUBSCRIPTION_STATE_EXPIRED':
      return terminada;
    case 'SUBSCRIPTION_STATE_PENDING':
      return { estado: 'pendiente' as const, fin: null };
    case 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED':
      return { estado: 'fallida' as const, fin: null };
  }
  throw new ErrorCompraNoValida('no_vigente');
}

/** La compra de subscriptionsv2 como la informa la tienda tras un aviso (HU-44.1). */
export function suscripcionEnTiendaDe(
  token: string,
  compra: CompraDeGoogle,
  ahora: Date,
): SuscripcionEnTienda {
  const linea = compra.lineItems[0];
  if (!linea) throw new ErrorCompraNoValida('no_encontrada');
  const fin = linea.expiryTime ? new Date(linea.expiryTime) : null;
  const { estado, fin: motivo } = estadoDe(compra, fin, ahora);
  const cobrada = estado === 'activa';
  return {
    idCompraTienda: token,
    estado,
    fin: motivo,
    idProducto: linea.productId,
    cuentaTienda: compra.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null,
    periodoInicio: null,
    periodoFin: fin,
    idPagoPasarela: cobrada
      ? (linea.latestSuccessfulOrderId ?? compra.latestOrderId ?? null)
      : null,
    renovacionAutomatica:
      linea.autoRenewingPlan?.autoRenewEnabled ??
      compra.subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE',
  };
}
