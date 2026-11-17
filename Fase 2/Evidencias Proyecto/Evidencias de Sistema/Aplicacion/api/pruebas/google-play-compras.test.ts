// Pasarela de Google Play (HU-43.1) con respuestas simuladas: cómo se traduce cada estado de
// purchases.subscriptionsv2 y cada error de Google. No llaman a Google: verificar con una compra real
// de prueba queda pendiente.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  compraDeGoogle,
  CUENTA,
  pasarela,
  TOKEN_COMPRA,
  URL_COMPRA,
} from './google-play-de-prueba.js';
import { motivoDe as motivo } from './http-falso.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PasarelaGooglePlay: estado de la compra', () => {
  const verificar = (cuerpo: unknown) =>
    pasarela({ [URL_COMPRA]: { estado: 200, cuerpo } }).google.verificarCompra(TOKEN_COMPRA);

  it('ACTIVE: activa, con producto, cuenta, período, cobro y la confirmación pendiente', async () => {
    expect(await verificar(compraDeGoogle())).toEqual({
      tienda: 'google_play',
      idCompraTienda: TOKEN_COMPRA,
      idProducto: 'todas_mensual',
      cuentaTienda: CUENTA,
      estado: 'activa',
      // subscriptionsv2 no informa el inicio del período en curso (startTime es el de la suscripción).
      periodoInicio: null,
      periodoFin: new Date('2027-04-15T11:59:00.000Z'),
      idPagoPasarela: 'GPA.3300-0000-0000-00001',
      porConfirmar: true,
      productoRenovacion: null,
    });
  });

  it('una compra ya confirmada no queda por confirmar', async () => {
    const compra = await verificar(
      compraDeGoogle({ acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' }),
    );

    expect(compra.porConfirmar).toBe(false);
  });

  it('sin la cuenta de la app, informa la cuenta vacía', async () => {
    const compra = await verificar(compraDeGoogle({ externalAccountIdentifiers: undefined }));

    expect(compra.cuentaTienda).toBeNull();
  });

  it('CANCELED con el período pagado vigente sigue activa hasta su fin', async () => {
    const compra = await verificar(
      compraDeGoogle({ subscriptionState: 'SUBSCRIPTION_STATE_CANCELED' }),
    );

    expect(compra).toMatchObject({
      estado: 'activa',
      periodoFin: new Date('2027-04-15T11:59:00.000Z'),
    });
  });

  it('CANCELED con el período ya terminado: COMPRA_NO_VALIDA no_vigente', async () => {
    const error: unknown = await verificar(
      compraDeGoogle(
        { subscriptionState: 'SUBSCRIPTION_STATE_CANCELED' },
        { expiryTime: '2027-03-15T11:00:00.000Z' },
      ),
    ).catch((e: unknown) => e);

    expect(error).toMatchObject({ estadoHttp: 422, codigo: 'COMPRA_NO_VALIDA' });
    expect(motivo(error)).toBe('no_vigente');
  });

  it('PENDING: el pago está en espera, sin cobro', async () => {
    const compra = await verificar(
      compraDeGoogle({ subscriptionState: 'SUBSCRIPTION_STATE_PENDING' }),
    );

    expect(compra).toMatchObject({
      estado: 'pendiente',
      idPagoPasarela: null,
      porConfirmar: false,
    });
  });

  it('PENDING_PURCHASE_CANCELED: el primer pago no se completó (fallida), sin cobro', async () => {
    const compra = await verificar(
      compraDeGoogle({ subscriptionState: 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED' }),
    );

    expect(compra).toMatchObject({ estado: 'fallida', idPagoPasarela: null, porConfirmar: false });
  });

  it.each(['ON_HOLD', 'PAUSED', 'EXPIRED', 'IN_GRACE_PERIOD', 'UNSPECIFIED'])(
    '%s: COMPRA_NO_VALIDA no_vigente',
    async (estado) => {
      const error: unknown = await verificar(
        compraDeGoogle({ subscriptionState: `SUBSCRIPTION_STATE_${estado}` }),
      ).catch((e: unknown) => e);

      expect(error).toMatchObject({ codigo: 'COMPRA_NO_VALIDA' });
      expect(motivo(error)).toBe('no_vigente');
    },
  );

  it('una respuesta sin el producto se trata como compra no encontrada', async () => {
    const error: unknown = await verificar(compraDeGoogle({ lineItems: [] })).catch(
      (e: unknown) => e,
    );

    expect(motivo(error)).toBe('no_encontrada');
  });
});

describe('PasarelaGooglePlay: errores de Google', () => {
  it.each([400, 404, 410])('%i: COMPRA_NO_VALIDA no_encontrada', async (estado) => {
    const { google } = pasarela({ [URL_COMPRA]: { estado, cuerpo: { error: { code: estado } } } });

    const error: unknown = await google.verificarCompra(TOKEN_COMPRA).catch((e: unknown) => e);

    expect(error).toMatchObject({ estadoHttp: 422, codigo: 'COMPRA_NO_VALIDA' });
    expect(motivo(error)).toBe('no_encontrada');
  });

  it.each([
    ['un 500', { estado: 500, cuerpo: {} }],
    ['un 503', { estado: 503, cuerpo: {} }],
    ['un 429', { estado: 429, cuerpo: {} }],
    ['un 401', { estado: 401, cuerpo: {} }],
    ['un error de red', new Error('ECONNRESET')],
  ])('con %s responde TIENDA_NO_DISPONIBLE sin mostrar el token', async (_caso, respuesta) => {
    const registro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { google } = pasarela({ [URL_COMPRA]: respuesta });

    const error: unknown = await google.verificarCompra(TOKEN_COMPRA).catch((e: unknown) => e);

    expect(error).toMatchObject({ estadoHttp: 503, codigo: 'TIENDA_NO_DISPONIBLE' });
    expect((error as Error).message).not.toContain(TOKEN_COMPRA);
    expect(JSON.stringify(registro.mock.calls)).not.toContain(TOKEN_COMPRA);
    expect(JSON.stringify(registro.mock.calls)).not.toContain('acceso-1');
  });
});
