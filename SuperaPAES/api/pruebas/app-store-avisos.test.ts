// Avisos de la App Store (HU-44.1, etapa 4) con respuestas simuladas: la verificación de la notificación
// firmada (JWS) con la cadena de certificados, cómo se traduce cada tipo y subtipo, y cómo se traduce
// cada estado de Get All Subscription Statuses. La cadena es de prueba: no llaman a Apple, y probar con
// un aviso real de sandbox queda fuera (sin cuenta de Apple Developer).
import { describe, expect, it } from 'vitest';
import { avisoApple, URL_ESTADOS_ORIGINAL } from './app-store-avisos-de-prueba.js';
import {
  AHORA,
  crearCadena,
  CUENTA,
  estados,
  ID_ORIGINAL,
  ID_TRANSACCION,
  pasarela,
  renovacion,
  transaccion,
} from './app-store-de-prueba.js';
import { motivoDe } from './http-falso.js';

const DIA = 86_400_000;
const { appStore } = pasarela({});
const error = (promesa: Promise<unknown>) =>
  promesa.then(
    () => null,
    (e: unknown) => e,
  );

describe('PasarelaAppStore: verificación del aviso (HU-44.1)', () => {
  it('verifica la notificación y la transacción, y traduce tipo y subtipo', async () => {
    const aviso = await avisoApple({ tipo: 'SUBSCRIBED', subtipo: 'INITIAL_BUY' });

    expect(await appStore.verificarAviso(aviso)).toEqual({
      tienda: 'app_store',
      idEvento: aviso.id,
      tipo: 'SUBSCRIBED/INITIAL_BUY',
      idCompraTienda: ID_ORIGINAL,
    });
    expect((await appStore.verificarAviso(await avisoApple({ tipo: 'DID_RENEW' }))).tipo).toBe(
      'DID_RENEW',
    );
  });

  it('un reembolso o una revocación se marcan como reembolso', async () => {
    for (const tipo of ['REFUND', 'REVOKE']) {
      expect(await appStore.verificarAviso(await avisoApple({ tipo }))).toMatchObject({
        tipo,
        reembolso: true,
      });
    }
  });

  it('el aviso TEST no trae compra', async () => {
    const aviso = await avisoApple({ tipo: 'TEST', sinTransaccion: true });

    expect(await appStore.verificarAviso(aviso)).toEqual({
      tienda: 'app_store',
      idEvento: aviso.id,
      tipo: 'TEST',
      idCompraTienda: null,
    });
  });

  it('una firma con otra cadena, de otra app o un cuerpo mal formado responden 400', async () => {
    const ajena = await avisoApple({ tipo: 'DID_RENEW', conCadena: crearCadena() });
    const otraApp = await avisoApple({ tipo: 'DID_RENEW', bundle: 'cl.otra.app' });
    const malFormado = { cuerpoCrudo: Buffer.from('{"otro":1}'), encabezados: {} };

    for (const aviso of [ajena, otraApp, malFormado]) {
      expect(await error(appStore.verificarAviso(aviso))).toMatchObject({
        estadoHttp: 400,
        codigo: 'SOLICITUD_INVALIDA',
      });
    }
  });

  it('fuera de sandbox la tienda no está disponible (503) y Apple reintenta', async () => {
    const enProduccion = pasarela({}, { entorno: 'produccion' }).appStore;

    expect(
      await error(enProduccion.verificarAviso(await avisoApple({ tipo: 'DID_RENEW' }))),
    ).toMatchObject({ estadoHttp: 503 });
  });
});

describe('PasarelaAppStore: estado de la suscripción tras un aviso (HU-44.1)', () => {
  const consultar = async (estado: number, datos: Parameters<typeof estados>[1] = {}) =>
    pasarela({
      [URL_ESTADOS_ORIGINAL]: { estado: 200, cuerpo: await estados(estado, datos) },
    }).appStore.consultarSuscripcion(ID_ORIGINAL);

  it('1: activa y renovando, con producto, cuenta, período y cobro', async () => {
    expect(await consultar(1)).toEqual({
      idCompraTienda: ID_ORIGINAL,
      estado: 'activa',
      fin: null,
      idProducto: 'todas_mensual',
      cuentaTienda: CUENTA,
      periodoInicio: new Date(AHORA.getTime() - 60_000),
      periodoFin: new Date(AHORA.getTime() + 30 * DIA),
      idPagoPasarela: ID_TRANSACCION,
      renovacionAutomatica: true,
    });
  });

  it('con la renovación apagada sigue activa, sin renovar (HU-45.1)', async () => {
    const enTienda = await consultar(1, { renovacion: renovacion({ autoRenewStatus: 0 }) });

    expect(enTienda).toMatchObject({ estado: 'activa', renovacionAutomatica: false });
  });

  it('3 (reintento de cobro) y 4 (período de gracia) quedan en mora, sin cobro', async () => {
    for (const estado of [3, 4]) {
      expect(await consultar(estado)).toMatchObject({ estado: 'en_mora', idPagoPasarela: null });
    }
  });

  it('2: terminada por cobro con intención 2 y, si no, porque no renovó', async () => {
    expect(await consultar(2, { renovacion: renovacion({ expirationIntent: 2 }) })).toMatchObject({
      estado: 'terminada',
      fin: 'cobro',
    });
    expect(await consultar(2, { renovacion: renovacion({ expirationIntent: 1 }) })).toMatchObject({
      estado: 'terminada',
      fin: 'no_renovo',
    });
  });

  it('5 o una fecha de revocación: terminada por reembolso', async () => {
    expect(await consultar(5)).toMatchObject({ estado: 'terminada', fin: 'reembolso' });
    const revocada = transaccion({ revocationDate: AHORA.getTime() });
    expect(await consultar(1, { transaccion: revocada })).toMatchObject({ fin: 'reembolso' });
  });

  it('una subida cambia el producto ya; una bajada espera a la renovación (CU-12 1.b)', async () => {
    const subida = transaccion({ productId: 'todas_anual' });
    expect((await consultar(1, { transaccion: subida })).idProducto).toBe('todas_anual');

    const bajada = renovacion({ autoRenewProductId: 'una_prueba_mensual' });
    expect((await consultar(1, { renovacion: bajada })).idProducto).toBe('todas_mensual');
  });

  it('una compra que Apple no encuentra no es válida', async () => {
    const noEsta = pasarela({ [URL_ESTADOS_ORIGINAL]: { estado: 404, cuerpo: {} } }).appStore;

    expect(motivoDe(await error(noEsta.consultarSuscripcion(ID_ORIGINAL)))).toBe('no_encontrada');
  });
});
