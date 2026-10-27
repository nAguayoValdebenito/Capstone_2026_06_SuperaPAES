import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorApi } from '../api/cliente';
import { responderUnaVez } from '../pruebas/sesion';
import {
  estadoDeError,
  intentarRestablecer,
  MENSAJES_RESTABLECER,
  validarContrasenas,
} from './restablecer-contrasena';

const cuerpoError = (codigo: string, mensaje: string, detalles?: unknown) => ({
  data: null,
  error: { codigo, mensaje, detalles },
  meta: null,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('validarContrasenas (A05)', () => {
  it('pide de 8 a 72 caracteres y que las dos coincidan', () => {
    expect(validarContrasenas('corta', 'corta')).toBe(
      'La contraseña debe tener al menos 8 caracteres.',
    );
    expect(validarContrasenas('una clave larga', 'otra clave larga')).toBe(
      MENSAJES_RESTABLECER.noCoinciden,
    );
    expect(validarContrasenas('una clave larga', 'una clave larga')).toBeNull();
  });
});

describe('crear la contraseña nueva (A05, CU-04)', () => {
  it('envía el token y la contraseña a /app/cuentas/recuperacion/restablecer', async () => {
    const fetchFalso = responderUnaVez({ data: { restablecida: true }, error: null, meta: null });

    const estado = await intentarRestablecer(
      'token-del-enlace',
      'una clave larga',
      'una clave larga',
    );

    expect(estado).toEqual({ tipo: 'restablecida' });
    const [url, init] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/app\/cuentas\/recuperacion\/restablecer$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      token: 'token-del-enlace',
      contrasena: 'una clave larga',
    });
  });

  it('si las contraseñas no coinciden no llama a la API', async () => {
    const fetchFalso = responderUnaVez({ data: null, error: null, meta: null });

    const estado = await intentarRestablecer('t', 'una clave larga', 'otra clave larga');

    expect(estado).toMatchObject({
      tipo: 'fallido',
      mensaje: MENSAJES_RESTABLECER.noCoinciden,
      deContrasena: true,
    });
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('una contraseña común se muestra bajo el campo, con el mensaje de la API (RN-31)', async () => {
    const mensaje = 'Esa contraseña es muy común y fácil de adivinar. Elige otra.';
    responderUnaVez(
      cuerpoError('VALIDACION', mensaje, [
        { lugar: 'cuerpo', ruta: 'contrasena', mensaje, motivo: 'contrasena_comun' },
      ]),
      400,
    );

    const estado = await intentarRestablecer('t', 'password123', 'password123');

    expect(estado).toEqual({
      tipo: 'fallido',
      mensaje,
      deContrasena: true,
      enlaceNoVigente: false,
    });
  });

  it('un enlace usado o vencido pide otro (HU-06 esc. 3)', async () => {
    const mensaje =
      'Este enlace no sirve: ya se usó, venció o pediste otro. Pide un enlace nuevo para crear tu contraseña.';
    responderUnaVez(cuerpoError('ENLACE_NO_VIGENTE', mensaje), 409);

    const estado = await intentarRestablecer('t', 'una clave larga', 'una clave larga');

    expect(estado).toEqual({
      tipo: 'fallido',
      mensaje,
      deContrasena: false,
      enlaceNoVigente: true,
    });
  });
});

describe('estadoDeError', () => {
  it('muestra el límite de intentos y la falta de conexión con su propio mensaje', () => {
    const limite = new ErrorApi(429, 'DEMASIADOS_INTENTOS', 'Hiciste demasiados intentos.');
    const conexion = new ErrorApi(0, 'SIN_CONEXION', 'No se pudo conectar con la API.');

    expect(estadoDeError(limite)).toMatchObject({ mensaje: 'Hiciste demasiados intentos.' });
    expect(estadoDeError(conexion)).toMatchObject({ mensaje: 'No se pudo conectar con la API.' });
  });

  it('cualquier otro error usa un mensaje general sin datos técnicos', () => {
    expect(estadoDeError(new ErrorApi(500, 'ERROR_INTERNO', 'stack…'))).toMatchObject({
      mensaje: MENSAJES_RESTABLECER.general,
    });
    expect(estadoDeError(new Error('x'))).toMatchObject({ mensaje: MENSAJES_RESTABLECER.general });
  });
});
