// Pasarela de la compra integrada de la App Store (StoreKit). Esqueleto: se completa en el sprint
// de suscripciones.
// - verificarAviso: verificará la firma JWS de App Store Server Notifications V2 con la cadena de
//   certificados de Apple y leerá notificationUUID, tipo y originalTransactionId.
// - verificarCompra y consultarSuscripcion: confirmarán la transacción con la App Store Server API
//   (JWT firmado con APP_STORE_CLAVE_PRIVADA, APP_STORE_ID_CLAVE y APP_STORE_ID_EMISOR) en el
//   entorno APP_STORE_ENTORNO.
import { ErrorNoImplementado } from '../../comun/errores.js';
import type { ConfiguracionAppStore } from '../../comun/configuracion.js';
import type {
  AvisoVerificado,
  CompraVerificada,
  PasarelaPago,
  SuscripcionEnTienda,
} from './pasarela.js';

export class PasarelaAppStore implements PasarelaPago {
  readonly nombre = 'app-store';

  constructor(private readonly opciones: ConfiguracionAppStore) {}

  verificarCompra(): Promise<CompraVerificada> {
    return Promise.reject(new ErrorNoImplementado('La verificación de compras de la App Store'));
  }

  confirmarCompra(): Promise<void> {
    return Promise.reject(new ErrorNoImplementado('La confirmación de compras de la App Store'));
  }

  consultarSuscripcion(): Promise<SuscripcionEnTienda> {
    return Promise.reject(new ErrorNoImplementado('La consulta de suscripciones en la App Store'));
  }

  verificarAviso(): Promise<AvisoVerificado> {
    return Promise.reject(new ErrorNoImplementado('Los avisos de la App Store'));
  }
}
