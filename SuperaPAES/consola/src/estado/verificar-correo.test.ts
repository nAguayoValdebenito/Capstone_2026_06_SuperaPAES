import { afterEach, describe, expect, it, vi } from 'vitest';
import { configurarToken, ErrorApi } from '../api/cliente';
import { responderUnaVez } from '../pruebas/sesion';
import { errorDeVerificacion, intentarVerificar, MENSAJES_VERIFICACION } from './verificar-correo';

afterEach(() => {
  configurarToken(() => null);
  vi.unstubAllGlobals();
});

describe('HU-05.4 · enlace público de verificación (CP-03, CU-02, RN-32)', () => {
  it('envía el token sin la sesión interna, incluso con un administrador conectado', async () => {
    configurarToken(() => 'sesion-interna-de-prueba');
    const peticion = responderUnaVez({
      data: { verificado: true, yaVerificado: false },
      error: null,
      meta: null,
    });

    expect(await intentarVerificar('enlace-de-prueba')).toEqual({
      tipo: 'verificado',
      yaVerificado: false,
    });
    expect(peticion).toHaveBeenCalledOnce();
    const [url, opciones] = peticion.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/app\/cuentas\/verificacion\/enlace$/);
    expect(opciones.method).toBe('POST');
    expect(JSON.parse(opciones.body as string)).toEqual({ token: 'enlace-de-prueba' });
    expect(new Headers(opciones.headers).has('Authorization')).toBe(false);
  });

  it('presenta como verificada una cuenta que la API informa que ya lo estaba', async () => {
    responderUnaVez({ data: { verificado: true, yaVerificado: true }, error: null, meta: null });
    expect(await intentarVerificar('enlace-de-prueba')).toEqual({
      tipo: 'verificado',
      yaVerificado: true,
    });
  });

  it('un enlace vencido, anulado o inexistente pide otro correo desde la app', async () => {
    responderUnaVez(
      {
        data: null,
        error: { codigo: 'VERIFICACION_NO_VIGENTE', mensaje: 'El enlace no sirve.' },
        meta: null,
      },
      409,
    );
    expect(await intentarVerificar('enlace-de-prueba')).toEqual({
      tipo: 'fallido',
      mensaje: MENSAJES_VERIFICACION.noVigente,
      reintentable: false,
    });
  });

  it.each(['', '   '])('no llama a la API si falta el token (%j)', async (token) => {
    const peticion = responderUnaVez({ data: null, error: null, meta: null });
    expect(await intentarVerificar(token)).toEqual({
      tipo: 'fallido',
      mensaje: MENSAJES_VERIFICACION.incompleto,
      reintentable: false,
    });
    expect(peticion).not.toHaveBeenCalled();
  });

  it.each([null, { verificado: false }, { verificado: true }])(
    'no anuncia éxito con una respuesta incompleta (%j)',
    async (data) => {
      responderUnaVez({ data, error: null, meta: null });
      expect(await intentarVerificar('enlace-de-prueba')).toMatchObject({ tipo: 'fallido' });
    },
  );

  it('permite reintentar cuando no hay conexión', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Fallo de red')));
    expect(await intentarVerificar('enlace-de-prueba')).toMatchObject({
      tipo: 'fallido',
      reintentable: true,
    });
  });

  it('no muestra detalles técnicos del servidor', () => {
    expect(errorDeVerificacion(new ErrorApi(500, 'ERROR_INTERNO', 'Detalle interno'))).toEqual({
      tipo: 'fallido',
      mensaje: MENSAJES_VERIFICACION.general,
      reintentable: true,
    });
  });

  it('muestra el límite de intentos comunicado por la API y permite reintentar después', () => {
    expect(
      errorDeVerificacion(new ErrorApi(429, 'DEMASIADOS_INTENTOS', 'Espera unos minutos.')),
    ).toMatchObject({ mensaje: 'Espera unos minutos.', reintentable: true });
  });
});
