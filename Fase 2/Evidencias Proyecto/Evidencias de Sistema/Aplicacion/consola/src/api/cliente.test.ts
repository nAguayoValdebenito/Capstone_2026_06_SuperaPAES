import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  configurarAlRechazarSesion,
  configurarRenovacion,
  configurarToken,
  ErrorApi,
  solicitar,
  solicitarAdmin,
} from './cliente';

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
  configurarAlRechazarSesion(() => undefined);
  configurarRenovacion(() => Promise.resolve(false));
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

  it('si la API rechaza una petición con token (401), avisa que la sesión ya no sirve', async () => {
    const alRechazar = vi.fn();
    configurarAlRechazarSesion(alRechazar);
    configurarToken(() => 'vencido');
    responder({ data: null, error: { codigo: 'NO_AUTENTICADO', mensaje: 'No' }, meta: null }, 401);

    expect((await errorDe(solicitarAdmin('/x'))).estadoHttp).toBe(401);
    expect(alRechazar).toHaveBeenCalledOnce();
  });

  it('un 401 sin token (por ejemplo, credenciales incorrectas en el ingreso) no cierra la sesión', async () => {
    const alRechazar = vi.fn();
    configurarAlRechazarSesion(alRechazar);
    responder({ data: null, error: { codigo: 'NO_AUTENTICADO', mensaje: 'No' }, meta: null }, 401);
    await errorDe(solicitarAdmin('/cuentas/ingreso'));

    configurarToken(() => 'abc');
    responder({ data: null, error: { codigo: 'SIN_PERMISO', mensaje: 'No' }, meta: null }, 403);
    await errorDe(solicitarAdmin('/x'));

    expect(alRechazar).not.toHaveBeenCalled();
  });

  it('si la API rechaza el token, renueva una vez y repite la petición con el token nuevo', async () => {
    let token = 'vencido';
    configurarToken(() => token);
    const renovar = vi.fn(() => {
      token = 'nuevo';
      return Promise.resolve(true);
    });
    configurarRenovacion(renovar);
    const alRechazar = vi.fn();
    configurarAlRechazarSesion(alRechazar);
    const fetchFalso = vi.fn((_url: string, init: RequestInit) => {
      const vigente = new Headers(init.headers).get('Authorization') === 'Bearer nuevo';
      const cuerpo = vigente
        ? { data: 'ok', error: null, meta: null }
        : { data: null, error: { codigo: 'NO_AUTENTICADO', mensaje: 'No' }, meta: null };
      return Promise.resolve(new Response(JSON.stringify(cuerpo), { status: vigente ? 200 : 401 }));
    });
    vi.stubGlobal('fetch', fetchFalso);

    const [una, otra] = await Promise.all([solicitarAdmin('/x'), solicitarAdmin('/y')]);

    expect(una.data).toBe('ok');
    expect(otra.data).toBe('ok');
    expect(renovar).toHaveBeenCalledOnce();
    expect(fetchFalso).toHaveBeenCalledTimes(4);
    expect(alRechazar).not.toHaveBeenCalled();
  });

  it('si no se puede renovar, avisa que la sesión terminó', async () => {
    configurarToken(() => 'vencido');
    configurarRenovacion(() => Promise.reject(new Error('credencial vencida')));
    const alRechazar = vi.fn();
    configurarAlRechazarSesion(alRechazar);
    responder({ data: null, error: { codigo: 'NO_AUTENTICADO', mensaje: 'No' }, meta: null }, 401);

    expect((await errorDe(solicitarAdmin('/x'))).estadoHttp).toBe(401);
    expect(alRechazar).toHaveBeenCalledOnce();
  });

  it('un 401 en las rutas de sesión no intenta renovar', async () => {
    configurarToken(() => 'vencido');
    const renovar = vi.fn(() => Promise.resolve(true));
    configurarRenovacion(renovar);
    responder({ data: null, error: { codigo: 'NO_AUTENTICADO', mensaje: 'No' }, meta: null }, 401);

    await errorDe(solicitarAdmin('/cuentas/renovar'));

    expect(renovar).not.toHaveBeenCalled();
  });

  it('marca SIN_CONEXION si fetch falla, pero deja pasar la cancelación', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('red')));
    expect((await errorDe(solicitar('/x'))).codigo).toBe('SIN_CONEXION');

    vi.stubGlobal('fetch', () => Promise.reject(new DOMException('x', 'AbortError')));
    await expect(solicitar('/x')).rejects.toBeInstanceOf(DOMException);
  });
});
