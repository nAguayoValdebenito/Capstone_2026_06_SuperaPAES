// Pasarela de Google Play (HU-43.1) con respuestas simuladas: el token de la cuenta de servicio y la
// confirmación de la compra (purchases.subscriptions.acknowledge). No llaman a Google: verificar con
// una compra real de prueba queda pendiente.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { importSPKI, jwtVerify } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AHORA,
  compraDeGoogle,
  CORREO_SERVICIO,
  cuentaServicio,
  llavePublica,
  pasarela,
  TOKEN_COMPRA,
  tokenDeAcceso,
  URL_COMPRA,
  URL_CONFIRMAR,
  URL_TOKEN,
} from './google-play-de-prueba.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PasarelaGooglePlay: cuenta de servicio', () => {
  it('pide el token con un JWT firmado por la cuenta de servicio y consulta la compra con él', async () => {
    const { google, peticiones } = pasarela({
      [URL_COMPRA]: { estado: 200, cuerpo: compraDeGoogle() },
    });

    await google.verificarCompra(TOKEN_COMPRA);

    const [token, consulta] = peticiones;
    expect(token).toMatchObject({ metodo: 'POST', url: URL_TOKEN });
    const formulario = new URLSearchParams(token?.cuerpo ?? '');
    expect(formulario.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    const { payload, protectedHeader } = await jwtVerify(
      formulario.get('assertion') ?? '',
      await importSPKI(llavePublica, 'RS256'),
      { currentDate: AHORA },
    );
    expect(protectedHeader.alg).toBe('RS256');
    expect(payload).toMatchObject({
      iss: CORREO_SERVICIO,
      aud: URL_TOKEN,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      iat: AHORA.getTime() / 1000,
      exp: AHORA.getTime() / 1000 + 3600,
    });
    expect(consulta).toMatchObject({
      metodo: 'GET',
      url: URL_COMPRA,
      encabezados: { Authorization: 'Bearer acceso-1' },
    });
  });

  it('reutiliza el token hasta un minuto antes de que venza y después pide otro', async () => {
    let ahora = AHORA;
    const { google, peticiones } = pasarela(
      {
        [URL_TOKEN]: [
          tokenDeAcceso,
          { estado: 200, cuerpo: { access_token: 'acceso-2', expires_in: 3599 } },
        ],
        [URL_COMPRA]: { estado: 200, cuerpo: compraDeGoogle() },
      },
      { reloj: () => ahora },
    );

    await google.verificarCompra(TOKEN_COMPRA);
    ahora = new Date(AHORA.getTime() + 3500 * 1000);
    await google.verificarCompra(TOKEN_COMPRA);
    ahora = new Date(AHORA.getTime() + 3560 * 1000);
    await google.verificarCompra(TOKEN_COMPRA);

    expect(peticiones.map((p) => p.url)).toEqual([
      URL_TOKEN,
      URL_COMPRA,
      URL_COMPRA,
      URL_TOKEN,
      URL_COMPRA,
    ]);
    expect(peticiones[4]?.encabezados?.['Authorization']).toBe('Bearer acceso-2');
  });

  it('lee la cuenta de servicio desde la ruta de un archivo', async () => {
    const carpeta = mkdtempSync(path.join(tmpdir(), 'cuenta-servicio-'));
    try {
      const archivo = path.join(carpeta, 'cuenta.json');
      writeFileSync(archivo, cuentaServicio);
      const { google } = pasarela(
        { [URL_COMPRA]: { estado: 200, cuerpo: compraDeGoogle() } },
        { cuenta: archivo },
      );

      expect((await google.verificarCompra(TOKEN_COMPRA)).estado).toBe('activa');
    } finally {
      rmSync(carpeta, { recursive: true, force: true });
    }
  });

  it.each([
    ['un marcador', 'marcador-del-primer-despliegue'],
    ['un JSON sin llave', '{"client_email":"x@y.cl"}'],
  ])('con %s responde TIENDA_NO_DISPONIBLE sin mostrar la configuración', async (_caso, cuenta) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { google, peticiones } = pasarela({}, { cuenta });

    await expect(google.verificarCompra(TOKEN_COMPRA)).rejects.toMatchObject({
      estadoHttp: 503,
      codigo: 'TIENDA_NO_DISPONIBLE',
    });
    expect(peticiones).toHaveLength(0);
    expect(JSON.stringify(error.mock.calls)).not.toContain(cuenta);
  });

  it('si Google rechaza la cuenta de servicio, responde TIENDA_NO_DISPONIBLE', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { google } = pasarela({
      [URL_TOKEN]: { estado: 400, cuerpo: { error: 'invalid_grant' } },
    });

    await expect(google.verificarCompra(TOKEN_COMPRA)).rejects.toMatchObject({
      codigo: 'TIENDA_NO_DISPONIBLE',
    });
  });
});

describe('PasarelaGooglePlay: confirmación (acknowledge)', () => {
  it('confirma la compra con su producto y su token', async () => {
    const { google, peticiones } = pasarela({ [URL_CONFIRMAR]: { estado: 200, cuerpo: {} } });

    await google.confirmarCompra({ idProducto: 'todas_mensual', idCompraTienda: TOKEN_COMPRA });

    expect(peticiones[1]).toMatchObject({
      metodo: 'POST',
      url: URL_CONFIRMAR,
      encabezados: { Authorization: 'Bearer acceso-1' },
    });
  });

  it('si Google falla, lo informa como TIENDA_NO_DISPONIBLE', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { google } = pasarela({ [URL_CONFIRMAR]: { estado: 503, cuerpo: {} } });

    await expect(
      google.confirmarCompra({ idProducto: 'todas_mensual', idCompraTienda: TOKEN_COMPRA }),
    ).rejects.toMatchObject({ codigo: 'TIENDA_NO_DISPONIBLE' });
  });
});
