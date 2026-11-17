// Configuración de pagos: variables que exige PROVEEDOR_PAGOS=tiendas y cómo se arma su configuración.
import { describe, expect, it } from 'vitest';
import { leerConfiguracion } from '../comun/configuracion.js';
import {
  variablesMinimas as minimas,
  variablesTiendas as tiendas,
} from './variables-configuracion.js';

describe('leerConfiguracion: pagos', () => {
  it('con PROVEEDOR_PAGOS=tiendas exige todas las variables de Google Play y la App Store', () => {
    let mensaje = '';
    try {
      leerConfiguracion({ ...minimas, PROVEEDOR_PAGOS: 'tiendas' });
    } catch (error) {
      mensaje = (error as Error).message;
    }

    for (const variable of Object.keys(tiendas).filter((v) => v !== 'PROVEEDOR_PAGOS')) {
      expect(mensaje).toContain(variable);
    }
  });

  it('con pagos simulados no exige las variables de las tiendas', () => {
    expect(() => leerConfiguracion({ ...minimas, PROVEEDOR_PAGOS: 'simulado' })).not.toThrow();
  });

  it('con todas las variables de las tiendas arma su configuración', () => {
    const config = leerConfiguracion({ ...minimas, ...tiendas });

    expect(config.pagos).toEqual({
      proveedor: 'tiendas',
      googlePlay: {
        paquete: 'cl.superapaes.app',
        cuentaServicio: '/secretos/cuenta-servicio.json',
        audienciaPubSub: 'https://api.superapaes.cl/api/v1/webhooks/google-play',
        correoPubSub: 'pubsub@ejemplo-ficticio.iam.gserviceaccount.com',
      },
      appStore: {
        bundleId: 'cl.superapaes.app',
        idEmisor: 'emisor',
        idClave: 'ABC123',
        clavePrivada: '-----BEGIN PRIVATE KEY-----',
        entorno: 'sandbox',
      },
    });
  });

  it('exige que GOOGLE_PLAY_PUBSUB_CORREO sea un correo', () => {
    expect(() =>
      leerConfiguracion({ ...minimas, ...tiendas, GOOGLE_PLAY_PUBSUB_CORREO: 'no-es-correo' }),
    ).toThrow(/GOOGLE_PLAY_PUBSUB_CORREO/);
  });

  it('rechaza un entorno de la App Store desconocido', () => {
    expect(() =>
      leerConfiguracion({ ...minimas, ...tiendas, APP_STORE_ENTORNO: 'pruebas' }),
    ).toThrow(/APP_STORE_ENTORNO/);
  });
});
