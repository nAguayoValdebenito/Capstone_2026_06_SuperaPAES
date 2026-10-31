// Interfaz común de las pasarelas de pago. Las suscripciones se compran dentro de la app con la
// facturación de las tiendas (Google Play Billing y StoreKit); la API solo verifica compras y avisos.
// Los estados son los códigos de contenido.estado_suscripcion y las tiendas, los de contenido.canal_venta.

export type Tienda = 'google_play' | 'app_store';

export type EstadoSuscripcion =
  'pendiente' | 'activa' | 'fallida' | 'en_mora' | 'cancelada' | 'vencida';

/**
 * Lo que la tienda confirma de una compra de suscripción (HU-43.1). La pasarela solo informa: el
 * servicio decide si la compra corresponde a la suscripción (cuenta y producto). Una compra que la
 * tienda no confirma se rechaza con ErrorCompraNoValida y una tienda caída, con ErrorTiendaNoDisponible.
 */
export interface CompraVerificada {
  tienda: Tienda;
  /** Identificador estable de la compra: token de Google Play o transacción original de la App Store. */
  idCompraTienda: string;
  /** Producto comprado (contenido.plan_producto_tienda.id_producto). */
  idProducto: string;
  /** Cuenta que la app pasó al comprar (obfuscatedAccountId o appAccountToken); null si no vino. */
  cuentaTienda: string | null;
  /**
   * activa: pagada y vigente, también cancelada con el período pagado vigente. pendiente: el pago está
   * en espera. fallida: el primer pago no se completó.
   */
  estado: 'activa' | 'pendiente' | 'fallida';
  /** Inicio y fin del período pagado, si hay cobro. */
  periodoInicio: Date | null;
  periodoFin: Date | null;
  /** Identificador del cobro (app.pago.id_pago_pasarela), si hubo cobro. */
  idPagoPasarela: string | null;
  /** Google Play: la compra aún no se confirma (acknowledge); si no se confirma, Google la reembolsa. */
  porConfirmar: boolean;
  /** App Store: producto de la próxima renovación, si es otro (una bajada rige al renovar, RN-05). */
  productoRenovacion: string | null;
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
  /** Consulta la compra en la tienda (token de Google Play o id de transacción de la App Store). */
  verificarCompra(idCompraTienda: string): Promise<CompraVerificada>;
  /** Confirma la compra en la tienda (acknowledge de Google Play); en la App Store no hace nada. */
  confirmarCompra(compra: Pick<CompraVerificada, 'idProducto' | 'idCompraTienda'>): Promise<void>;
  consultarSuscripcion(idCompraTienda: string): Promise<SuscripcionEnTienda>;
  /** Verifica el origen del aviso (token de Pub/Sub o firma JWS de Apple) y lo traduce. */
  verificarAviso(aviso: AvisoEntrante): Promise<AvisoVerificado>;
}

/** Una pasarela por tienda; con PROVEEDOR_PAGOS=simulado ambas son la pasarela simulada. */
export type PasarelasPorTienda = Record<Tienda, PasarelaPago>;
