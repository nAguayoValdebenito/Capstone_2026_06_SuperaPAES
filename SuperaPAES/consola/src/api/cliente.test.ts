import { afterEach, describe, expect, it, vi } from 'vitest';
import { configurarToken, ErrorApi, solicitar, solicitarAdmin } from './cliente';

function responder(cuerpo: unknown, estado = 200) {
  const fetchFalso = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(cuerpo), { status: estado })),
  );
  vi.stubGlobal('fetch', fetchFalso);
  return fetchFalso;
}

async function errorDe(promesa: Promise<unknown>): Promise<ErrorApi> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof ErrorApi) return error;
  }
  throw new Error('Se esperaba un ErrorApi.');
}

afterEach(() => {
  vi.unstubAllGlobals();
  configurarToken(() => null);
});

describe('cliente de la API', () => {
  it('devuelve data y meta, y arma los encabezados', async () => {
    const fetchFalso = responder({ data: { estado: 'ok' }, error: null, meta: { total: 1 } });
    configurarToken(() => 'abc');

    const respuesta = await solicitarAdmin<{ estado: string }>('/x', { body: '{}' });

    expect(respuesta).toEqual({ data: { estado: 'ok' }, meta: { total: 1 } });
    const [url, init] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/admin\/x$/);
    const encabezados = new Headers(init.headers);
    expect(encabezados.get('Authorization')).toBe('Bearer abc');
    expect(encabezados.get('Content-Type')).toBe('application/json');
  });

  it('traduce el error de la API', async () => {
    responder({ data: null, error: { codigo: 'NO_AUTORIZADO', mensaje: 'No' }, meta: null }, 401);

    const error = await errorDe(solicitar('/x'));

    expect(error.codigo).toBe('NO_AUTORIZADO');
    expect(error.estadoHttp).toBe(401);
  });

  it('usa ERROR_DESCONOCIDO si falla sin detalle de error', async () => {
    responder({ data: null, error: null, meta: null }, 500);

    expect((await errorDe(solicitar('/x'))).codigo).toBe('ERROR_DESCONOCIDO');
  });

  it('marca RESPUESTA_INVALIDA si el cuerpo no tiene el formato', async () => {
    responder({ hola: 1 });

    expect((await errorDe(solicitar('/x'))).codigo).toBe('RESPUESTA_INVALIDA');
  });

  it('marca SIN_CONEXION si fetch falla, pero deja pasar la cancelación', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('red')));
    expect((await errorDe(solicitar('/x'))).codigo).toBe('SIN_CONEXION');

    vi.stubGlobal('fetch', () => Promise.reject(new DOMException('x', 'AbortError')));
    await expect(solicitar('/x')).rejects.toBeInstanceOf(DOMException);
  });
});
