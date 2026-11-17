// Pasarela de Google Play Billing (HU-43.1). Consulta la compra en la Google Play Developer API
// (purchases.subscriptionsv2.get) y la confirma (purchases.subscriptions.acknowledge) con un token de
// la cuenta de servicio GOOGLE_PLAY_CUENTA_SERVICIO: el JWT se firma con jose (RS256) y se cambia por
// un token de acceso (OAuth 2.0), que se reutiliza hasta un minuto antes de vencer. El cliente HTTP y
// el reloj se inyectan. Nada de la compra, la llave ni el token llega a los registros.
// - verificarAviso y consultarSuscripcion (HU-44.1): avisos RTDN por Cloud Pub/Sub con la audiencia
//   GOOGLE_PLAY_PUBSUB_AUDIENCIA, verificados y traducidos en google-play-avisos.ts.
import { readFile } from 'node:fs/promises';
import { importPKCS8, SignJWT, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';
import type { ConfiguracionGooglePlay } from '../../comun/configuracion.js';
import { ErrorCompraNoValida } from '../../comun/errores.js';
import { relojDelSistema, type Reloj } from '../../comun/reloj.js';
import {
  clienteHttpFetch,
  type ClienteHttp,
  type PeticionHttp,
  type RespuestaHttp,
} from './http.js';
import {
  esquemaCompra,
  llavesDeGoogle,
  suscripcionEnTiendaDe,
  verificarAvisoGoogle,
  type CompraDeGoogle,
} from './google-play-avisos.js';
import type {
  AvisoEntrante,
  AvisoVerificado,
  CompraVerificada,
  PasarelaPago,
  SuscripcionEnTienda,
} from './pasarela.js';
import { leerJson, noDisponible, pedirATienda } from './respuestas-tienda.js';

const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const ALCANCE = 'https://www.googleapis.com/auth/androidpublisher';
const VIGENCIA_JWT_S = 3600;
const MARGEN_TOKEN_MS = 60_000;

const esquemaCuentaServicio = z.object({
  client_email: z.string().min(1),
  private_key: z.string().min(1),
  token_uri: z.url().default('https://oauth2.googleapis.com/token'),
});

const esquemaToken = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
});

interface CuentaServicio {
  correo: string;
  urlToken: string;
  llave: Awaited<ReturnType<typeof importPKCS8>>;
}

export interface DependenciasGooglePlay {
  http?: ClienteHttp;
  reloj?: Reloj;
  /** Llaves públicas de Google para el token de Pub/Sub; por defecto, las publicadas por Google. */
  llavesPubSub?: JWTVerifyGetKey;
}

/**
 * Estados de Google (decisiones del 31/10/2026): ACTIVE activa; CANCELED sigue activa mientras el
 * período pagado esté vigente; PENDING queda pendiente; PENDING_PURCHASE_CANCELED es un primer pago que
 * no se completó (fallida). ON_HOLD, PAUSED, EXPIRED, IN_GRACE_PERIOD y los demás no activan
 * (no_vigente): cuáles pasan a en mora se decide con los avisos (HU-44).
 */
function estadoDe(
  compra: CompraDeGoogle,
  fin: Date | null,
  ahora: Date,
): CompraVerificada['estado'] {
  switch (compra.subscriptionState) {
    case 'SUBSCRIPTION_STATE_ACTIVE':
      return 'activa';
    case 'SUBSCRIPTION_STATE_CANCELED':
      if (fin !== null && fin > ahora) return 'activa';
      break;
    case 'SUBSCRIPTION_STATE_PENDING':
      return 'pendiente';
    case 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED':
      return 'fallida';
  }
  throw new ErrorCompraNoValida('no_vigente');
}

function aCompraVerificada(token: string, compra: CompraDeGoogle, ahora: Date): CompraVerificada {
  const linea = compra.lineItems[0];
  if (!linea) throw new ErrorCompraNoValida('no_encontrada');
  const fin = linea.expiryTime ? new Date(linea.expiryTime) : null;
  const estado = estadoDe(compra, fin, ahora);
  const cobrada = estado === 'activa';
  return {
    tienda: 'google_play',
    idCompraTienda: token,
    idProducto: linea.productId,
    cuentaTienda: compra.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null,
    estado,
    // subscriptionsv2 no informa el inicio del período en curso (startTime es el de la suscripción).
    periodoInicio: null,
    periodoFin: cobrada ? fin : null,
    idPagoPasarela: cobrada
      ? (linea.latestSuccessfulOrderId ?? compra.latestOrderId ?? null)
      : null,
    porConfirmar: cobrada && compra.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING',
    productoRenovacion: null,
  };
}

export class PasarelaGooglePlay implements PasarelaPago {
  readonly nombre = 'google-play';
  private readonly http: ClienteHttp;
  private readonly reloj: Reloj;
  private readonly llavesPubSub: JWTVerifyGetKey;
  private cuenta: CuentaServicio | null = null;
  private token: { valor: string; venceEn: number } | null = null;

  constructor(
    private readonly opciones: ConfiguracionGooglePlay,
    dependencias: DependenciasGooglePlay = {},
  ) {
    this.http = dependencias.http ?? clienteHttpFetch;
    this.reloj = dependencias.reloj ?? relojDelSistema;
    this.llavesPubSub = dependencias.llavesPubSub ?? llavesDeGoogle();
  }

  async verificarCompra(idCompraTienda: string): Promise<CompraVerificada> {
    const compra = await this.compraEnGoogle(idCompraTienda);
    return aCompraVerificada(idCompraTienda, compra, this.reloj());
  }

  async confirmarCompra(
    compra: Pick<CompraVerificada, 'idProducto' | 'idCompraTienda'>,
  ): Promise<void> {
    const producto = encodeURIComponent(compra.idProducto);
    const token = encodeURIComponent(compra.idCompraTienda);
    const respuesta = await this.pedirConToken({
      metodo: 'POST',
      url: `${this.urlCompras()}/subscriptions/${producto}/tokens/${token}:acknowledge`,
      encabezados: { 'Content-Type': 'application/json' },
      cuerpo: '{}',
    });
    if (respuesta.estado !== 200 && respuesta.estado !== 204)
      throw noDisponible('google_play', 'la confirmación de la compra falló', {
        estadoHttp: respuesta.estado,
      });
  }

  /** HU-44.1: el estado de hoy de la compra, tras un aviso (purchases.subscriptionsv2.get). */
  async consultarSuscripcion(idCompraTienda: string): Promise<SuscripcionEnTienda> {
    const compra = await this.compraEnGoogle(idCompraTienda);
    return suscripcionEnTiendaDe(idCompraTienda, compra, this.reloj());
  }

  /** HU-44.1: verifica el token del envío de Pub/Sub y traduce la notificación. */
  verificarAviso(aviso: AvisoEntrante): Promise<AvisoVerificado> {
    return verificarAvisoGoogle(aviso, {
      audiencia: this.opciones.audienciaPubSub,
      paquete: this.opciones.paquete,
      llaves: this.llavesPubSub,
      ahora: this.reloj(),
    });
  }

  /** purchases.subscriptionsv2.get: una compra que Google no encuentra no es válida. */
  private async compraEnGoogle(idCompraTienda: string): Promise<CompraDeGoogle> {
    const respuesta = await this.pedirConToken({
      metodo: 'GET',
      url: `${this.urlCompras()}/subscriptionsv2/tokens/${encodeURIComponent(idCompraTienda)}`,
    });
    if ([400, 404, 410].includes(respuesta.estado)) throw new ErrorCompraNoValida('no_encontrada');
    if (respuesta.estado !== 200)
      throw noDisponible('google_play', 'la consulta de la compra falló', {
        estadoHttp: respuesta.estado,
      });
    return leerJson('google_play', respuesta, esquemaCompra, 'la compra');
  }

  private urlCompras(): string {
    return `${API}/${encodeURIComponent(this.opciones.paquete)}/purchases`;
  }

  private async pedirConToken(peticion: PeticionHttp): Promise<RespuestaHttp> {
    const acceso = await this.tokenDeAcceso();
    return this.pedir({
      ...peticion,
      encabezados: { ...peticion.encabezados, Authorization: `Bearer ${acceso}` },
    });
  }

  private pedir(peticion: PeticionHttp): Promise<RespuestaHttp> {
    return pedirATienda('google_play', this.http, peticion);
  }

  private async tokenDeAcceso(): Promise<string> {
    const ahora = this.reloj().getTime();
    if (this.token && ahora < this.token.venceEn - MARGEN_TOKEN_MS) return this.token.valor;
    const cuenta = await this.cuentaServicio();
    const respuesta = await this.pedir({
      metodo: 'POST',
      url: cuenta.urlToken,
      encabezados: { 'Content-Type': 'application/x-www-form-urlencoded' },
      cuerpo: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: await afirmacionDe(cuenta, Math.floor(ahora / 1000)),
      }).toString(),
    });
    if (respuesta.estado !== 200)
      throw noDisponible('google_play', 'rechazó la cuenta de servicio', {
        estadoHttp: respuesta.estado,
      });
    const token = leerJson('google_play', respuesta, esquemaToken, 'el token de acceso');
    this.token = { valor: token.access_token, venceEn: ahora + token.expires_in * 1000 };
    return token.access_token;
  }

  /** El JSON de la cuenta de servicio, escrito en la variable o en el archivo que indica. */
  private async cuentaServicio(): Promise<CuentaServicio> {
    if (this.cuenta) return this.cuenta;
    try {
      const texto = this.opciones.cuentaServicio.trim();
      const json = texto.startsWith('{') ? texto : await readFile(texto, 'utf8');
      const datos = esquemaCuentaServicio.parse(JSON.parse(json));
      this.cuenta = {
        correo: datos.client_email,
        urlToken: datos.token_uri,
        llave: await importPKCS8(datos.private_key, 'RS256'),
      };
      return this.cuenta;
    } catch {
      throw noDisponible('google_play', 'la cuenta de servicio no es válida');
    }
  }
}

/** JWT de la cuenta de servicio (RFC 7523) que Google cambia por un token de acceso. */
function afirmacionDe(cuenta: CuentaServicio, segundos: number): Promise<string> {
  return new SignJWT({ scope: ALCANCE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(cuenta.correo)
    .setAudience(cuenta.urlToken)
    .setIssuedAt(segundos)
    .setExpirationTime(segundos + VIGENCIA_JWT_S)
    .sign(cuenta.llave);
}
