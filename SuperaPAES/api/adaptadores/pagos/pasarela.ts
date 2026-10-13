// Interfaz común de las pasarelas de pago. Las suscripciones se compran dentro de la app con la
// facturación de las tiendas (Google Play Billing y StoreKit); la API solo verifica compras y avisos.
// Los estados coinciden con app.suscripcion.estado.

export type Tienda = 'google_play' | 'app_store';

export type EstadoSuscripcion =
  'pendiente' | 'activa' | 'fallida' | 'en_mora' | 'cancelada' | 'vencida';

export interface SolicitudVerificacionCompra {
  tienda: Tienda;
  /** Identificador del producto en la tienda (contenido.plan.id_producto_google o id_producto_apple). */
  idProducto: string;
  /** Token de compra de Google Play o transacción original de la App Store (app.suscripcion.id_compra_tienda). */
  idCompraTienda: string;
}

export interface CompraVerificada {
  tienda: Tienda;
  idProducto: string;
  idCompraTienda: string;
  estado: EstadoSuscripcion;
  /** Fin del período pagado, si la tienda lo informa. */
  periodoFin: Date | null;
  /** Identificador del cobro (app.pago.id_pago_pasarela), si hubo cobro. */
  idPagoPasarela: string | null;
}

export interface SuscripcionEnTienda {
  idCompraTienda: string;
  estado: EstadoSuscripcion;
  periodoFin: Date | null;
  renovacionAutomatica: boolean;
}

/** Aviso tal como llega a /api/v1/webhooks/<tienda>, antes de verificarlo. */
export interface AvisoEntrante {
  cuerpoCrudo: Buffer;
  encabezados: Record<string, string | string[] | undefined>;
}

/** Aviso ya verificado. Su identificador evita procesarlo dos veces (app.evento_pasarela). */
export interface AvisoVerificado {
  tienda: Tienda;
  /** messageId de Google Play o notificationUUID de la App Store. */
  idEvento: string;
  /** Tipo original, por ejemplo SUBSCRIPTION_RENEWED o DID_RENEW. */
  tipo: string;
  idCompraTienda: string | null;
}

export interface PasarelaPago {
  readonly nombre: 'simulado' | 'google-play' | 'app-store';
  verificarCompra(solicitud: SolicitudVerificacionCompra): Promise<CompraVerificada>;
  consultarSuscripcion(idCompraTienda: string): Promise<SuscripcionEnTienda>;
  /** Verifica el origen del aviso (token de Pub/Sub o firma JWS de Apple) y lo traduce. */
  verificarAviso(aviso: AvisoEntrante): Promise<AvisoVerificado>;
}

/** Una pasarela por tienda; con PROVEEDOR_PAGOS=simulado ambas son la pasarela simulada. */
export type PasarelasPorTienda = Record<Tienda, PasarelaPago>;
