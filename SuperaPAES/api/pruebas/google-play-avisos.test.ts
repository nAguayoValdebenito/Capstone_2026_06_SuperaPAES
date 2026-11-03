// Avisos de Google Play (HU-44.1, etapa 3) con respuestas simuladas: cómo se verifica el token del
// envío de Cloud Pub/Sub, cómo se lee la notificación y cómo se traduce cada estado de
// purchases.subscriptionsv2. No llaman a Google: probar con un aviso real queda fuera (sin cuenta de
// Google Play Console).
import { describe, expect, it } from 'vitest';
import {
  AUDIENCIA,
  envio,
  ID_MENSAJE,
  notificacionDeSuscripcion,
  pasarelaConAvisos,
  tokenPubSub,
} from './google-play-avisos-de-prueba.js';
import { compraDeGoogle, PAQUETE, TOKEN_COMPRA, URL_COMPRA } from './google-play-de-prueba.js';
import { motivoDe } from './http-falso.js';

const google = pasarelaConAvisos();
const verificar = async (notificacion: unknown, token?: string) =>
  google.verificarAviso(envio(notificacion, token ?? (await tokenPubSub())));
const error = (promesa: Promise<unknown>) =>
  promesa.then(
    () => null,
    (e: unknown) => e,
  );

describe('PasarelaGooglePlay: verificación del aviso (HU-44.1)', () => {
  it('con el token de Google traduce la notificación de la suscripción', async () => {
    expect(await verificar(notificacionDeSuscripcion(2))).toEqual({
      tienda: 'google_play',
      idEvento: ID_MENSAJE,
      tipo: 'SUBSCRIPTION_RENEWED',
      idCompraTienda: TOKEN_COMPRA,
    });
    expect((await verificar(notificacionDeSuscripcion(6))).tipo).toBe(
      'SUBSCRIPTION_IN_GRACE_PERIOD',
    );
    expect((await verificar(notificacionDeSuscripcion(99))).tipo).toBe('SUBSCRIPTION_99');
  });

  it('una revocación o un reembolso de la suscripción se marcan como reembolso', async () => {
    expect(await verificar(notificacionDeSuscripcion(12))).toMatchObject({
      tipo: 'SUBSCRIPTION_REVOKED',
      reembolso: true,
    });
    const anulada = {
      packageName: PAQUETE,
      voidedPurchaseNotification: { purchaseToken: TOKEN_COMPRA, productType: 1, refundType: 1 },
    };
    expect(await verificar(anulada)).toMatchObject({
      tipo: 'VOIDED_PURCHASE',
      idCompraTienda: TOKEN_COMPRA,
      reembolso: true,
    });
  });

  it('el aviso de prueba y el de un producto de una vez no traen compra de suscripción', async () => {
    expect(await verificar({ packageName: PAQUETE, testNotification: { version: '1.0' } })).toEqual(
      {
        tienda: 'google_play',
        idEvento: ID_MENSAJE,
        tipo: 'TEST_NOTIFICATION',
        idCompraTienda: null,
      },
    );
    const deUnaVez = {
      packageName: PAQUETE,
      voidedPurchaseNotification: { purchaseToken: 'otro', productType: 2 },
    };
    expect(await verificar(deUnaVez)).toMatchObject({ tipo: 'OTRO', idCompraTienda: null });
  });

  it.each([
    ['sin token', undefined],
    ['firmado con otra llave', { llaveAjena: true }],
    ['para otra audiencia', { audiencia: `${AUDIENCIA}/otra` }],
    ['de otro emisor', { emisor: 'https://otro.example.com' }],
    ['sin el correo verificado', { claims: { email_verified: false } }],
    ['vencido', { vencido: true }],
  ])('un token %s responde 401 y no se procesa', async (_caso, cambios) => {
    const token = cambios === undefined ? undefined : await tokenPubSub(cambios);
    const rechazo = await error(google.verificarAviso(envio(notificacionDeSuscripcion(), token)));

    expect(rechazo).toMatchObject({ estadoHttp: 401, codigo: 'NO_AUTENTICADO' });
    expect(String(rechazo)).not.toContain(TOKEN_COMPRA);
  });

  it('un aviso de otra app o mal formado responde 400 sin mostrar su contenido', async () => {
    const otraApp = { ...notificacionDeSuscripcion(), packageName: 'cl.otra.app' };
    const token = await tokenPubSub();
    const sinBase64 = {
      cuerpoCrudo: Buffer.from(JSON.stringify({ message: { data: 'no-es-json', messageId: '1' } })),
      encabezados: { authorization: `Bearer ${token}` },
    };

    for (const rechazo of [
      await error(verificar(otraApp)),
      await error(google.verificarAviso(sinBase64)),
      await error(google.verificarAviso({ ...sinBase64, cuerpoCrudo: Buffer.from('no json') })),
    ]) {
      expect(rechazo).toMatchObject({ estadoHttp: 400, codigo: 'SOLICITUD_INVALIDA' });
      expect(String(rechazo)).not.toContain('cl.otra.app');
    }
  });
});

describe('PasarelaGooglePlay: estado de la compra tras un aviso (HU-44.1)', () => {
  const consultar = (cuerpo: unknown, estado = 200) =>
    pasarelaConAvisos({ [URL_COMPRA]: { estado, cuerpo } }).consultarSuscripcion(TOKEN_COMPRA);
  const FIN = new Date('2027-04-15T11:59:00.000Z');
  const vencida = { expiryTime: '2027-03-15T11:00:00.000Z' };

  it('ACTIVE: activa y renovando, con producto, cuenta, período y cobro', async () => {
    expect(await consultar(compraDeGoogle())).toEqual({
      idCompraTienda: TOKEN_COMPRA,
      estado: 'activa',
      fin: null,
      idProducto: 'todas_mensual',
      cuentaTienda: '4ea3b5d0-1c2e-8f00-9a1b-2c3d4e5f6a7b',
      periodoInicio: null,
      periodoFin: FIN,
      idPagoPasarela: 'GPA.3300-0000-0000-00001',
      renovacionAutomatica: true,
    });
  });

  it('CANCELED con el período vigente sigue activa, sin renovar (HU-45.1)', async () => {
    const compra = compraDeGoogle(
      {
        subscriptionState: 'SUBSCRIPTION_STATE_CANCELED',
        canceledStateContext: { userInitiatedCancellation: {} },
      },
      { autoRenewingPlan: { autoRenewEnabled: false } },
    );

    expect(await consultar(compra)).toMatchObject({
      estado: 'activa',
      renovacionAutomatica: false,
    });
  });

  it('período de gracia y retención de cuenta quedan en mora, sin cobro', async () => {
    for (const estado of ['SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_ON_HOLD']) {
      expect(await consultar(compraDeGoogle({ subscriptionState: estado }))).toMatchObject({
        estado: 'en_mora',
        idPagoPasarela: null,
      });
    }
  });

  it.each([
    ['CANCELED', 'userInitiatedCancellation', 'no_renovo'],
    ['EXPIRED', 'systemInitiatedCancellation', 'cobro'],
    ['EXPIRED', 'developerInitiatedCancellation', 'reembolso'],
  ])('%s terminado por %s: terminada (%s)', async (estado, causa, fin) => {
    const compra = compraDeGoogle(
      { subscriptionState: `SUBSCRIPTION_STATE_${estado}`, canceledStateContext: { [causa]: {} } },
      vencida,
    );

    expect(await consultar(compra)).toMatchObject({
      estado: 'terminada',
      fin,
      idPagoPasarela: null,
    });
  });

  it('EXPIRED sin causa termina como no renovada (desde en mora, el núcleo la deja vencida)', async () => {
    const compra = compraDeGoogle({ subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED' }, vencida);

    expect(await consultar(compra)).toMatchObject({ estado: 'terminada', fin: 'no_renovo' });
  });

  it('PAUSED y el estado sin especificar no se atienden: COMPRA_NO_VALIDA no_vigente', async () => {
    for (const estado of ['SUBSCRIPTION_STATE_PAUSED', 'SUBSCRIPTION_STATE_UNSPECIFIED']) {
      expect(motivoDe(await error(consultar(compraDeGoogle({ subscriptionState: estado }))))).toBe(
        'no_vigente',
      );
    }
  });

  it('una compra que Google no encuentra no es válida y una falla de Google es 503', async () => {
    expect(motivoDe(await error(consultar({}, 404)))).toBe('no_encontrada');
    expect(await error(consultar({}, 500))).toMatchObject({ estadoHttp: 503 });
  });
});
