// Pasarela de la App Store (HU-43.1) con respuestas simuladas: errores de la App Store Server API,
// configuración no válida y confirmación. No llaman a Apple.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  configuracion,
  estados,
  ID_TRANSACCION,
  pasarela,
  URL_ESTADOS,
} from './app-store-de-prueba.js';
import { motivoDe } from './http-falso.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PasarelaAppStore: errores de Apple', () => {
  it.each([400, 404])('%i: COMPRA_NO_VALIDA no_encontrada', async (estado) => {
    const { appStore } = pasarela({
      [URL_ESTADOS]: { estado, cuerpo: { errorCode: 4040010, errorMessage: 'not found' } },
    });

    const error: unknown = await appStore.verificarCompra(ID_TRANSACCION).catch((e: unknown) => e);

    expect(error).toMatchObject({ estadoHttp: 422, codigo: 'COMPRA_NO_VALIDA' });
    expect(motivoDe(error)).toBe('no_encontrada');
  });

  it.each([
    ['un 401', { estado: 401, cuerpo: '' }],
    ['un 429', { estado: 429, cuerpo: { errorCode: 4290000 } }],
    ['un 500', { estado: 500, cuerpo: { errorCode: 5000000 } }],
    ['una respuesta que no es JSON', { estado: 200, cuerpo: 'no es json' }],
    ['un error de red', new Error('ETIMEDOUT')],
  ])('con %s responde TIENDA_NO_DISPONIBLE sin mostrar la compra', async (_caso, respuesta) => {
    const registro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { appStore } = pasarela({ [URL_ESTADOS]: respuesta });

    const error: unknown = await appStore.verificarCompra(ID_TRANSACCION).catch((e: unknown) => e);

    expect(error).toMatchObject({ estadoHttp: 503, codigo: 'TIENDA_NO_DISPONIBLE' });
    expect(JSON.stringify(registro.mock.calls)).not.toContain(ID_TRANSACCION);
  });
});

describe('PasarelaAppStore: configuración', () => {
  it.each([
    ['una clave privada que es un marcador', { clavePrivada: 'marcador' }],
    ['el entorno de producción, fuera del alcance', { entorno: 'produccion' as const }],
  ])('con %s responde TIENDA_NO_DISPONIBLE sin llamar a Apple', async (_caso, cambios) => {
    const registro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { appStore, peticiones } = pasarela({}, cambios);

    await expect(appStore.verificarCompra(ID_TRANSACCION)).rejects.toMatchObject({
      codigo: 'TIENDA_NO_DISPONIBLE',
    });
    expect(peticiones).toHaveLength(0);
    expect(JSON.stringify(registro.mock.calls)).not.toContain('marcador');
  });

  it('acepta la clave privada con los saltos de línea escritos como \\n en la variable', async () => {
    const { appStore } = pasarela(
      { [URL_ESTADOS]: { estado: 200, cuerpo: await estados() } },
      { clavePrivada: configuracion.clavePrivada.replaceAll('\n', '\\n') },
    );

    expect((await appStore.verificarCompra(ID_TRANSACCION)).estado).toBe('activa');
  });
});

describe('PasarelaAppStore: confirmación', () => {
  it('la App Store no pide confirmar la compra en el servidor: no llama a Apple', async () => {
    const { appStore, peticiones } = pasarela({});

    await appStore.confirmarCompra({ idProducto: 'todas_mensual', idCompraTienda: ID_TRANSACCION });

    expect(peticiones).toHaveLength(0);
  });
});
