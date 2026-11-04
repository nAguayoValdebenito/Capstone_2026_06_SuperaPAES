import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorApi } from '../api/cliente';
import { responderUnaVez } from '../pruebas/sesion';
import { estadoDeError, MENSAJES_VERIFICACION, verificarConEnlace } from './verificar-correo';

const exito = (yaVerificado: boolean) => ({
  data: { verificado: true, yaVerificado },
  error: null,
  meta: null,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('verificar el correo con el enlace (HU-05.4, CU-02)', () => {
  it('envía el token del enlace a /app/cuentas/verificacion/enlace', async () => {
    const fetchFalso = responderUnaVez(exito(false));

    expect(await verificarConEnlace('token-del-enlace')).toEqual({ tipo: 'verificado' });

    const [url, init] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/app\/cuentas\/verificacion\/enlace$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ token: 'token-del-enlace' });
  });

  it('un correo que ya estaba verificado no es un error', async () => {
    responderUnaVez(exito(true));

    expect(await verificarConEnlace('token')).toEqual({ tipo: 'ya_verificado' });
  });
});

describe('estadoDeError (CU-02 3.b)', () => {
  it('un enlace usado, vencido o reemplazado ofrece pedir un correo nuevo', () => {
    const mensaje = 'Este enlace o código ya no sirve.';

    expect(estadoDeError(new ErrorApi(409, 'VERIFICACION_NO_VIGENTE', mensaje))).toEqual({
      tipo: 'no_vigente',
      mensaje,
    });
  });

  it.each(['DEMASIADOS_INTENTOS', 'SIN_CONEXION', 'SIN_CONFIGURACION'])(
    '%s muestra el mensaje de la API',
    (codigo) => {
      expect(estadoDeError(new ErrorApi(429, codigo, 'Mensaje claro.'))).toEqual({
        tipo: 'fallido',
        mensaje: 'Mensaje claro.',
      });
    },
  );

  it('cualquier otro error muestra el mensaje general, sin el detalle técnico', () => {
    const general = { tipo: 'fallido', mensaje: MENSAJES_VERIFICACION.general };

    expect(estadoDeError(new ErrorApi(500, 'ERROR_INTERNO', 'detalle'))).toEqual(general);
    expect(estadoDeError(new Error('detalle'))).toEqual(general);
  });
});
