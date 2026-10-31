// Pasarela de la compra integrada de la App Store (StoreKit, HU-43.1). Consulta el estado de la
// suscripción en la App Store Server API (Get All Subscription Statuses) con un JWT ES256 firmado con
// jose (APP_STORE_CLAVE_PRIVADA, APP_STORE_ID_CLAVE y APP_STORE_ID_EMISOR) y verifica la transacción y la
// renovación firmadas (JWS) con SignedDataVerifier de @apple/app-store-server-library, que valida la
// cadena de certificados hasta la raíz de Apple (certificados-apple.ts) y el bundle. Solo el entorno de
// prueba (sandbox): producción queda fuera de HU-43.1. El cliente HTTP y el reloj se inyectan; la
// consulta OCSP de la biblioteca, no.
// - verificarAviso y consultarSuscripcion: App Store Server Notifications V2 (HU-44).
import {
  Environment,
  SignedDataVerifier,
  VerificationException,
  VerificationStatus,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
} from '@apple/app-store-server-library';
import { importPKCS8, SignJWT } from 'jose';
import { z } from 'zod';
import type { ConfiguracionAppStore } from '../../comun/configuracion.js';
import { ErrorCompraNoValida, ErrorNoImplementado } from '../../comun/errores.js';
import { relojDelSistema, type Reloj } from '../../comun/reloj.js';
import { certificadosRaizApple } from './certificados-apple.js';
import { clienteHttpFetch, type ClienteHttp } from './http.js';
import type {
  AvisoVerificado,
  CompraVerificada,
  PasarelaPago,
  SuscripcionEnTienda,
} from './pasarela.js';
import { leerJson, noDisponible, pedirATienda } from './respuestas-tienda.js';

const URL_SANDBOX = 'https://api.storekit-sandbox.itunes.apple.com';
const VIGENCIA_JWT_S = 300;

/** StatusResponse: solo los campos que se usan. */
const esquemaEstados = z.object({
  data: z
    .array(
      z.object({
        lastTransactions: z
          .array(
            z.object({
              status: z.number(),
              signedTransactionInfo: z.string().min(1),
              signedRenewalInfo: z.string().min(1).optional(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

export interface DependenciasAppStore {
  http?: ClienteHttp;
  reloj?: Reloj;
  /** Raíces de confianza en DER; por defecto, las de Apple guardadas en el repositorio. */
  certificadosRaiz?: Buffer[];
  /** Revocación (OCSP) y vigencia de la cadena a la hora actual; las pruebas la apagan. */
  verificacionEnLinea?: boolean;
}

interface Preparada {
  llave: Awaited<ReturnType<typeof importPKCS8>>;
  verificador: SignedDataVerifier;
}

/** Firma no comprobada, bundle de otra app o entorno distinto: la compra no vale para esta app. */
async function decodificar<T>(verificacion: () => Promise<T>): Promise<T> {
  try {
    return await verificacion();
  } catch (error) {
    if (!(error instanceof VerificationException)) throw error;
    if (error.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE)
      throw noDisponible('app_store', 'no se pudo comprobar la revocación de la cadena');
    if (error.status === VerificationStatus.INVALID_APP_IDENTIFIER)
      throw new ErrorCompraNoValida('otro_paquete');
    if (error.status === VerificationStatus.INVALID_ENVIRONMENT)
      throw new ErrorCompraNoValida('no_encontrada');
    throw new ErrorCompraNoValida('firma_invalida');
  }
}

/**
 * Estados de Apple: 1 activa (también cancelada con el período vigente); 5 o una fecha de revocación,
 * revocada; 2 vencida, 3 reintento de cobro y 4 período de gracia no activan (no_vigente): cuáles pasan
 * a en mora se decide con los avisos (HU-44).
 */
function comprobarEstado(estado: number, transaccion: JWSTransactionDecodedPayload): void {
  if (estado === 5 || transaccion.revocationDate !== undefined)
    throw new ErrorCompraNoValida('revocada');
  if (estado !== 1) throw new ErrorCompraNoValida('no_vigente');
}

function aCompraVerificada(
  transaccion: JWSTransactionDecodedPayload,
  renovacion: JWSRenewalInfoDecodedPayload | null,
): CompraVerificada {
  const { originalTransactionId, transactionId, productId, expiresDate } = transaccion;
  if (!originalTransactionId || !transactionId || !productId || expiresDate === undefined)
    throw new ErrorCompraNoValida('no_encontrada');
  const siguiente = renovacion?.autoRenewProductId;
  return {
    tienda: 'app_store',
    idCompraTienda: originalTransactionId,
    idProducto: productId,
    cuentaTienda: transaccion.appAccountToken ?? null,
    estado: 'activa',
    periodoInicio:
      transaccion.purchaseDate === undefined ? null : new Date(transaccion.purchaseDate),
    periodoFin: new Date(expiresDate),
    idPagoPasarela: transactionId,
    porConfirmar: false,
    productoRenovacion: siguiente !== undefined && siguiente !== productId ? siguiente : null,
  };
}

export class PasarelaAppStore implements PasarelaPago {
  readonly nombre = 'app-store';
  private readonly http: ClienteHttp;
  private readonly reloj: Reloj;
  private preparada: Preparada | null = null;

  constructor(
    private readonly opciones: ConfiguracionAppStore,
    private readonly dependencias: DependenciasAppStore = {},
  ) {
    this.http = dependencias.http ?? clienteHttpFetch;
    this.reloj = dependencias.reloj ?? relojDelSistema;
  }

  async verificarCompra(idTransaccion: string): Promise<CompraVerificada> {
    const { llave, verificador } = await this.preparar();
    const respuesta = await pedirATienda('app_store', this.http, {
      metodo: 'GET',
      url: `${URL_SANDBOX}/inApps/v1/subscriptions/${encodeURIComponent(idTransaccion)}`,
      encabezados: { Authorization: `Bearer ${await this.tokenDeLaApi(llave)}` },
    });
    if (respuesta.estado === 400 || respuesta.estado === 404)
      throw new ErrorCompraNoValida('no_encontrada');
    if (respuesta.estado !== 200)
      throw noDisponible('app_store', 'la consulta de la suscripción falló', {
        estadoHttp: respuesta.estado,
      });
    const ultima = leerJson('app_store', respuesta, esquemaEstados, 'los estados').data[0]
      ?.lastTransactions[0];
    if (!ultima) throw new ErrorCompraNoValida('no_encontrada');
    const transaccion = await decodificar(() =>
      verificador.verifyAndDecodeTransaction(ultima.signedTransactionInfo),
    );
    const firmada = ultima.signedRenewalInfo;
    const renovacion = firmada
      ? await decodificar(() => verificador.verifyAndDecodeRenewalInfo(firmada))
      : null;
    comprobarEstado(ultima.status, transaccion);
    return aCompraVerificada(transaccion, renovacion);
  }

  /** La App Store no pide confirmar las compras desde el servidor. */
  confirmarCompra(_compra: Pick<CompraVerificada, 'idProducto' | 'idCompraTienda'>): Promise<void> {
    return Promise.resolve();
  }

  consultarSuscripcion(): Promise<SuscripcionEnTienda> {
    return Promise.reject(new ErrorNoImplementado('La consulta de suscripciones en la App Store'));
  }

  verificarAviso(): Promise<AvisoVerificado> {
    return Promise.reject(new ErrorNoImplementado('Los avisos de la App Store'));
  }

  /** JWT de la App Store Server API: 5 minutos, con el bundle de la app. */
  private tokenDeLaApi(llave: Preparada['llave']): Promise<string> {
    const segundos = Math.floor(this.reloj().getTime() / 1000);
    return new SignJWT({ bid: this.opciones.bundleId })
      .setProtectedHeader({ alg: 'ES256', kid: this.opciones.idClave, typ: 'JWT' })
      .setIssuer(this.opciones.idEmisor)
      .setAudience('appstoreconnect-v1')
      .setIssuedAt(segundos)
      .setExpirationTime(segundos + VIGENCIA_JWT_S)
      .sign(llave);
  }

  /** La clave de la API y el verificador; una configuración no válida es una tienda no disponible. */
  private async preparar(): Promise<Preparada> {
    if (this.preparada) return this.preparada;
    if (this.opciones.entorno !== 'sandbox')
      throw noDisponible('app_store', 'solo el entorno de prueba (sandbox) está habilitado');
    try {
      // La clave .p8 puede venir en una sola línea, con los saltos escritos como \n.
      const llave = await importPKCS8(this.opciones.clavePrivada.replaceAll('\\n', '\n'), 'ES256');
      const verificador = new SignedDataVerifier(
        this.dependencias.certificadosRaiz ?? certificadosRaizApple(),
        this.dependencias.verificacionEnLinea ?? true,
        Environment.SANDBOX,
        this.opciones.bundleId,
      );
      this.preparada = { llave, verificador };
      return this.preparada;
    } catch {
      throw noDisponible('app_store', 'la configuración de la App Store no es válida');
    }
  }
}
