// Pasarela de la App Store (HU-43.1) con respuestas simuladas: la autenticación con la App Store
// Server API, cómo se traduce cada estado de la suscripción y la verificación de la firma (JWS) con la
// cadena de certificados. La cadena es de prueba, generada en memoria: no llaman a Apple, y verificar
// con una compra real de prueba (sandbox) queda pendiente.
import { importSPKI, jwtVerify } from 'jose';
import { describe, expect, it } from 'vitest';
import {
  AHORA,
  BUNDLE,
  configuracion,
  claveApi,
  crearCadena,
  CUENTA,
  estados,
  firmar,
  ID_ORIGINAL,
  ID_TRANSACCION,
  pasarela,
  renovacion,
  transaccion,
  URL_ESTADOS,
} from './app-store-de-prueba.js';
import { motivoDe } from './http-falso.js';

const verificar = async (cuerpo: unknown) =>
  pasarela({ [URL_ESTADOS]: { estado: 200, cuerpo } }).appStore.verificarCompra(ID_TRANSACCION);

const motivoAlVerificar = async (cuerpo: unknown) =>
  motivoDe(await verificar(cuerpo).catch((error: unknown) => error));

describe('PasarelaAppStore: App Store Server API', () => {
  it('consulta los estados con un JWT ES256 de la clave de la API (sandbox)', async () => {
    const { appStore, peticiones } = pasarela({
      [URL_ESTADOS]: { estado: 200, cuerpo: await estados() },
    });

    await appStore.verificarCompra(ID_TRANSACCION);

    expect(peticiones).toHaveLength(1);
    expect(peticiones[0]).toMatchObject({ metodo: 'GET', url: URL_ESTADOS });
    const autorizacion = peticiones[0]?.encabezados?.['Authorization'] ?? '';
    expect(autorizacion).toMatch(/^Bearer /);
    const { payload, protectedHeader } = await jwtVerify(
      autorizacion.slice('Bearer '.length),
      await importSPKI(claveApi.publicaPem, 'ES256'),
      { currentDate: AHORA },
    );
    expect(protectedHeader).toEqual({ alg: 'ES256', kid: configuracion.idClave, typ: 'JWT' });
    expect(payload).toEqual({
      iss: configuracion.idEmisor,
      aud: 'appstoreconnect-v1',
      bid: BUNDLE,
      iat: AHORA.getTime() / 1000,
      exp: AHORA.getTime() / 1000 + 300,
    });
  });
});

describe('PasarelaAppStore: estado de la suscripción', () => {
  it('1 (activa): la transacción original, el producto, la cuenta, el período y el cobro', async () => {
    const tx = transaccion();

    expect(await verificar(await estados(1))).toEqual({
      tienda: 'app_store',
      idCompraTienda: ID_ORIGINAL,
      idProducto: 'todas_mensual',
      cuentaTienda: CUENTA,
      estado: 'activa',
      periodoInicio: new Date(tx.purchaseDate),
      periodoFin: new Date(tx.expiresDate),
      idPagoPasarela: ID_TRANSACCION,
      porConfirmar: false,
      productoRenovacion: null,
    });
  });

  it('cancelada por el estudiante pero vigente (sin renovación automática) sigue activa', async () => {
    const compra = await verificar(
      await estados(1, { renovacion: renovacion({ autoRenewStatus: 0 }) }),
    );

    expect(compra.estado).toBe('activa');
  });

  it('una bajada informa el producto de la próxima renovación (RN-05)', async () => {
    const compra = await verificar(
      await estados(1, { renovacion: renovacion({ autoRenewProductId: 'una_prueba_mensual' }) }),
    );

    expect(compra).toMatchObject({
      idProducto: 'todas_mensual',
      productoRenovacion: 'una_prueba_mensual',
    });
  });

  it('sin appAccountToken, informa la cuenta vacía', async () => {
    const compra = await verificar(
      await estados(1, { transaccion: transaccion({ appAccountToken: undefined }) }),
    );

    expect(compra.cuentaTienda).toBeNull();
  });

  it.each([
    [2, 'vencida'],
    [3, 'reintento de cobro'],
    [4, 'período de gracia'],
  ])('%i (%s): COMPRA_NO_VALIDA no_vigente', async (estado) => {
    expect(await motivoAlVerificar(await estados(estado))).toBe('no_vigente');
  });

  it('5 (revocada) o una transacción con fecha de revocación: COMPRA_NO_VALIDA revocada', async () => {
    const reembolsada = transaccion({
      revocationDate: AHORA.getTime() - 1000,
      revocationReason: 0,
    });

    expect(await motivoAlVerificar(await estados(5))).toBe('revocada');
    expect(await motivoAlVerificar(await estados(1, { transaccion: reembolsada }))).toBe(
      'revocada',
    );
  });

  it('sin suscripciones en la respuesta: COMPRA_NO_VALIDA no_encontrada', async () => {
    expect(await motivoAlVerificar({ environment: 'Sandbox', bundleId: BUNDLE, data: [] })).toBe(
      'no_encontrada',
    );
  });
});

describe('PasarelaAppStore: firma de Apple', () => {
  it('una cadena que no termina en la raíz de confianza: firma_invalida', async () => {
    const ajena = crearCadena();
    const firmaTransaccion = await firmar(transaccion(), ajena);

    expect(await motivoAlVerificar(await estados(1, { firmaTransaccion }))).toBe('firma_invalida');
  });

  it('una hoja sin el OID de Apple: firma_invalida', async () => {
    const sinOid = crearCadena(false);
    const firmaTransaccion = await firmar(transaccion(), sinOid);

    expect(await motivoAlVerificar(await estados(1, { firmaTransaccion }))).toBe('firma_invalida');
  });

  it('un contenido cambiado después de firmar: firma_invalida', async () => {
    const [cabecera, , firma] = (await firmar(transaccion())).split('.');
    const cambiado = Buffer.from(
      JSON.stringify(transaccion({ productId: 'todas_anual' })),
    ).toString('base64url');

    const firmaTransaccion = `${cabecera ?? ''}.${cambiado}.${firma ?? ''}`;

    expect(await motivoAlVerificar(await estados(1, { firmaTransaccion }))).toBe('firma_invalida');
  });

  it('una compra de otra app: otro_paquete', async () => {
    const otraApp = transaccion({ bundleId: 'cl.otra.app' });

    expect(await motivoAlVerificar(await estados(1, { transaccion: otraApp }))).toBe(
      'otro_paquete',
    );
  });

  it('una compra de producción en el entorno de prueba: no_encontrada', async () => {
    const produccion = transaccion({ environment: 'Production' });

    expect(await motivoAlVerificar(await estados(1, { transaccion: produccion }))).toBe(
      'no_encontrada',
    );
  });
});
