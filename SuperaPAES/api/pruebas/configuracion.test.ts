import { describe, expect, it } from 'vitest';
import { ErrorConfiguracion, leerConfiguracion } from '../comun/configuracion.js';
import {
  CLAVE_CODIGO_DE_PRUEBA,
  SECRETO_APP_DE_PRUEBA,
  SECRETO_DE_PRUEBA,
  URL_CONSOLA_DE_PRUEBA,
} from './ayudantes.js';

const minimas = {
  // Valor de prueba, no es un secreto. secretlint-disable-next-line
  DATABASE_URL: 'postgres://usuario:clave@localhost:5432/supera_paes',
  JWT_SECRETO_CONSOLA: SECRETO_DE_PRUEBA,
  JWT_SECRETO_APP: SECRETO_APP_DE_PRUEBA,
  URL_CONSOLA: URL_CONSOLA_DE_PRUEBA,
  CORS_ORIGENES: URL_CONSOLA_DE_PRUEBA,
  CLAVE_CODIGO_CORREO: CLAVE_CODIGO_DE_PRUEBA,
};

const tiendas = {
  PROVEEDOR_PAGOS: 'tiendas',
  GOOGLE_PLAY_PAQUETE: 'cl.superapaes.app',
  GOOGLE_PLAY_CUENTA_SERVICIO: '/secretos/cuenta-servicio.json',
  GOOGLE_PLAY_PUBSUB_AUDIENCIA: 'https://api.superapaes.cl/api/v1/webhooks/google-play',
  APP_STORE_BUNDLE_ID: 'cl.superapaes.app',
  APP_STORE_ID_EMISOR: 'emisor',
  APP_STORE_ID_CLAVE: 'ABC123',
  APP_STORE_CLAVE_PRIVADA: '-----BEGIN PRIVATE KEY-----',
  APP_STORE_ENTORNO: 'sandbox',
};

describe('leerConfiguracion', () => {
  it('arranca con las tres variables obligatorias y usa proveedores simulados', () => {
    const config = leerConfiguracion(minimas);

    expect(config.puerto).toBe(3000);
    expect(config.ia).toEqual({ proveedor: 'simulado' });
    expect(config.correo).toEqual({ proveedor: 'consola' });
    expect(config.pagos).toEqual({ proveedor: 'simulado' });
    expect(config.baseDeDatos.ssl).toBe(false);
  });

  it('falla indicando las variables obligatorias que faltan', () => {
    expect(() => leerConfiguracion({ DATABASE_URL: minimas.DATABASE_URL })).toThrow(
      /JWT_SECRETO_CONSOLA[\s\S]*JWT_SECRETO_APP/,
    );
  });

  it.each([
    ['deepseek', /DEEPSEEK_API_KEY/],
    ['gemini', /GEMINI_API_KEY/],
  ])('exige la clave del proveedor de IA elegido (%s)', (proveedor, variable) => {
    expect(() => leerConfiguracion({ ...minimas, PROVEEDOR_IA: proveedor })).toThrow(variable);
  });

  it('exige los datos de SMTP solo si el correo es smtp', () => {
    expect(() => leerConfiguracion({ ...minimas, PROVEEDOR_CORREO: 'smtp' })).toThrow(
      /SMTP_HOST[\s\S]*SMTP_PORT[\s\S]*CORREO_REMITENTE/,
    );
  });

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

  it('rechaza un entorno de la App Store desconocido', () => {
    expect(() =>
      leerConfiguracion({ ...minimas, ...tiendas, APP_STORE_ENTORNO: 'pruebas' }),
    ).toThrow(/APP_STORE_ENTORNO/);
  });

  describe('en producción', () => {
    const produccion = {
      ...minimas,
      ...tiendas,
      NODE_ENV: 'production',
      URL_CONSOLA: 'https://consola.superapaes.cl',
      CORS_ORIGENES: 'https://consola.superapaes.cl',
      PROVEEDOR_CORREO: 'smtp',
      SMTP_HOST: 'smtp.ejemplo.cl',
      SMTP_PORT: '587',
      CORREO_REMITENTE: 'Supera PAES <no-responder@ejemplo.cl>',
      PROVEEDOR_IA: 'deepseek',
      DEEPSEEK_API_KEY: 'clave',
    };

    it('arranca con proveedores reales', () => {
      expect(() => leerConfiguracion(produccion)).not.toThrow();
    });

    it.each([
      ['PROVEEDOR_PAGOS', 'simulado', /PROVEEDOR_PAGOS[\s\S]*tiendas/],
      ['PROVEEDOR_CORREO', 'consola', /PROVEEDOR_CORREO[\s\S]*smtp/],
      ['PROVEEDOR_IA', 'simulado', /PROVEEDOR_IA[\s\S]*deepseek o gemini/],
    ])('rechaza %s=%s', (variable, valor, mensaje) => {
      expect(() => leerConfiguracion({ ...produccion, [variable]: valor })).toThrow(mensaje);
    });

    it('exige https en URL_CONSOLA', () => {
      expect(() =>
        leerConfiguracion({
          ...produccion,
          URL_CONSOLA: 'http://consola.superapaes.cl',
          CORS_ORIGENES: 'http://consola.superapaes.cl',
        }),
      ).toThrow(/URL_CONSOLA[\s\S]*https/);
    });

    it('rechaza los proveedores de desarrollo aunque falte la variable', () => {
      let mensaje = '';
      try {
        leerConfiguracion({ ...minimas, NODE_ENV: 'production' });
      } catch (error) {
        mensaje = (error as Error).message;
      }

      for (const variable of ['PROVEEDOR_PAGOS', 'PROVEEDOR_CORREO', 'PROVEEDOR_IA']) {
        expect(mensaje).toContain(variable);
      }
    });
  });

  it('rechaza un proveedor de pagos desconocido', () => {
    expect(() => leerConfiguracion({ ...minimas, PROVEEDOR_PAGOS: 'otro' })).toThrow(
      /PROVEEDOR_PAGOS/,
    );
  });

  it('separa CORS_ORIGENES por comas', () => {
    const config = leerConfiguracion({
      ...minimas,
      CORS_ORIGENES: 'http://localhost:5173, https://consola.superapaes.cl',
    });

    expect(config.corsOrigenes).toEqual(['http://localhost:5173', 'https://consola.superapaes.cl']);
  });

  it('trata los números vacíos como no definidos', () => {
    const config = leerConfiguracion({ ...minimas, PORT: '', SMTP_PORT: '' });

    expect(config.puerto).toBe(3000);
  });

  describe('correo de verificación (RN-32)', () => {
    it('entrega la dirección de la consola sin / final y la clave del código', () => {
      const config = leerConfiguracion({ ...minimas, URL_CONSOLA: `${URL_CONSOLA_DE_PRUEBA}/` });

      expect(config.verificacionCorreo).toEqual({
        urlConsola: URL_CONSOLA_DE_PRUEBA,
        claveCodigo: CLAVE_CODIGO_DE_PRUEBA,
      });
    });

    it.each(['URL_CONSOLA', 'CLAVE_CODIGO_CORREO'])('exige %s', (variable) => {
      expect(() => leerConfiguracion({ ...minimas, [variable]: undefined })).toThrow(variable);
    });

    it('exige que el origen de URL_CONSOLA esté en CORS_ORIGENES', () => {
      expect(() =>
        leerConfiguracion({ ...minimas, CORS_ORIGENES: 'https://otra.superapaes.cl' }),
      ).toThrow(/CORS_ORIGENES[\s\S]*http:\/\/localhost:5173/);
    });

    it('rechaza una clave del código corta o igual a un secreto JWT', () => {
      expect(() => leerConfiguracion({ ...minimas, CLAVE_CODIGO_CORREO: 'corta' })).toThrow(
        /CLAVE_CODIGO_CORREO/,
      );
      expect(() =>
        leerConfiguracion({ ...minimas, CLAVE_CODIGO_CORREO: SECRETO_APP_DE_PRUEBA }),
      ).toThrow(/CLAVE_CODIGO_CORREO[\s\S]*distinta/);
    });
  });

  it('rechaza el mismo secreto para la consola y la app', () => {
    expect(() =>
      leerConfiguracion({ ...minimas, JWT_SECRETO_APP: minimas.JWT_SECRETO_CONSOLA }),
    ).toThrow(/JWT_SECRETO_APP[\s\S]*distint/);
  });

  it('no incluye valores secretos en el mensaje de error', () => {
    let error: unknown;
    try {
      leerConfiguracion({
        ...minimas,
        ...tiendas,
        JWT_SECRETO_APP: 'corto',
        PROVEEDOR_IA: 'otro',
        APP_STORE_ENTORNO: 'x',
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(ErrorConfiguracion);
    const mensaje = (error as Error).message;
    expect(mensaje).not.toContain(minimas.JWT_SECRETO_CONSOLA);
    expect(mensaje).not.toContain('clave@');
    expect(mensaje).not.toContain('BEGIN PRIVATE KEY');
  });
});
