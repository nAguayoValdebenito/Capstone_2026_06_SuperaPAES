// Mapeo de la configuración de pagos (Google Play y App Store), separado de la configuración general de
// la API. La validación de las variables sigue en configuracion.ts.

export interface VariablesPagos {
  PROVEEDOR_PAGOS: 'simulado' | 'tiendas';
  GOOGLE_PLAY_PAQUETE?: string | undefined;
  GOOGLE_PLAY_CUENTA_SERVICIO?: string | undefined;
  GOOGLE_PLAY_PUBSUB_AUDIENCIA?: string | undefined;
  GOOGLE_PLAY_PUBSUB_CORREO?: string | undefined;
  APP_STORE_BUNDLE_ID?: string | undefined;
  APP_STORE_ID_EMISOR?: string | undefined;
  APP_STORE_ID_CLAVE?: string | undefined;
  APP_STORE_CLAVE_PRIVADA?: string | undefined;
  APP_STORE_ENTORNO?: 'sandbox' | 'produccion' | undefined;
}

export interface ConfiguracionGooglePlay {
  paquete: string;
  /** Ruta o contenido del JSON de la cuenta de servicio de la Google Play Developer API. */
  cuentaServicio: string;
  /** Audiencia esperada en el token de los envíos de Cloud Pub/Sub. */
  audienciaPubSub: string;
  /** Correo de la cuenta de servicio de la suscripción push: el único emisor aceptado del token. */
  correoPubSub: string;
}

export interface ConfiguracionAppStore {
  bundleId: string;
  idEmisor: string;
  idClave: string;
  clavePrivada: string;
  entorno: 'sandbox' | 'produccion';
}

export type ConfiguracionPagos =
  | { proveedor: 'simulado' }
  | { proveedor: 'tiendas'; googlePlay: ConfiguracionGooglePlay; appStore: ConfiguracionAppStore };

// Tras la validación, con PROVEEDOR_PAGOS=tiendas todas existen: `?? ''` solo satisface al tipo.
function googlePlayDe(v: VariablesPagos): ConfiguracionGooglePlay {
  return {
    paquete: v.GOOGLE_PLAY_PAQUETE ?? '',
    cuentaServicio: v.GOOGLE_PLAY_CUENTA_SERVICIO ?? '',
    audienciaPubSub: v.GOOGLE_PLAY_PUBSUB_AUDIENCIA ?? '',
    correoPubSub: v.GOOGLE_PLAY_PUBSUB_CORREO ?? '',
  };
}

function appStoreDe(v: VariablesPagos): ConfiguracionAppStore {
  return {
    bundleId: v.APP_STORE_BUNDLE_ID ?? '',
    idEmisor: v.APP_STORE_ID_EMISOR ?? '',
    idClave: v.APP_STORE_ID_CLAVE ?? '',
    clavePrivada: v.APP_STORE_CLAVE_PRIVADA ?? '',
    entorno: v.APP_STORE_ENTORNO ?? 'sandbox',
  };
}

export function leerConfiguracionPagos(v: VariablesPagos): ConfiguracionPagos {
  if (v.PROVEEDOR_PAGOS === 'simulado') return { proveedor: 'simulado' };
  return { proveedor: 'tiendas', googlePlay: googlePlayDe(v), appStore: appStoreDe(v) };
}
