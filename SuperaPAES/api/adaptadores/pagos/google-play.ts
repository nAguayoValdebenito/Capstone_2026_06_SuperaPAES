// Pasarela de Google Play Billing. Esqueleto: se completa en el sprint de suscripciones.
// - verificarAviso: comprobará el token de autenticación (OIDC) del envío de Cloud Pub/Sub con
//   la audiencia GOOGLE_PLAY_PUBSUB_AUDIENCIA y leerá el RTDN (messageId, tipo, purchaseToken).
// - verificarCompra y consultarSuscripcion: consultarán purchases.subscriptionsv2 en la Google Play
//   Developer API con la cuenta de servicio GOOGLE_PLAY_CUENTA_SERVICIO.
import { ErrorNoImplementado } from '../../comun/errores.js';
import type { ConfiguracionGooglePlay } from '../../comun/configuracion.js';
import type {
  AvisoVerificado,
  CompraVerificada,
  PasarelaPago,
  SuscripcionEnTienda,
} from './pasarela.js';

export class PasarelaGooglePlay implements PasarelaPago {
  readonly nombre = 'google-play';

  constructor(private readonly opciones: ConfiguracionGooglePlay) {}

  verificarCompra(): Promise<CompraVerificada> {
    return Promise.reject(new ErrorNoImplementado('La verificación de compras de Google Play'));
  }

  consultarSuscripcion(): Promise<SuscripcionEnTienda> {
    return Promise.reject(new ErrorNoImplementado('La consulta de suscripciones en Google Play'));
  }

  verificarAviso(): Promise<AvisoVerificado> {
    return Promise.reject(new ErrorNoImplementado('Los avisos de Google Play'));
  }
}
