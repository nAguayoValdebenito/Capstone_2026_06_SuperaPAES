import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorApi } from '../api/cliente';
import { responderUnaVez, sesionDePrueba } from '../pruebas/sesion';
import { intentarIngreso, MENSAJES_INGRESO, mensajeErrorIngreso } from './ingreso';

const credenciales = { correo: 'docente@ejemplo.cl', contrasena: 'una clave' };

const cuerpoError = (codigo: string) => ({
  data: null,
  error: { codigo, mensaje: 'texto del servidor' },
  meta: null,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ingreso a la consola (C00)', () => {
  it('envía el correo y la contraseña a /admin/cuentas/ingreso e inicia la sesión', async () => {
    const sesion = sesionDePrueba('docente');
    const fetchFalso = responderUnaVez({ data: sesion, error: null, meta: null });
    const iniciarSesion = vi.fn(() => true);

    const estado = await intentarIngreso(credenciales, iniciarSesion);

    expect(estado).toEqual({ tipo: 'ingresado' });
    expect(iniciarSesion).toHaveBeenCalledWith(sesion);
    const [url, init] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/admin\/cuentas\/ingreso$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(credenciales);
  });

  // Regla de acceso: estudiante, correo sin cuenta interna, clave incorrecta o usuario desactivado
  // reciben el mismo mensaje, responda la API 401 o 403.
  it.each([
    [401, 'NO_AUTENTICADO'],
    [403, 'SIN_PERMISO'],
  ] as const)(
    'con %i %s el mensaje es el mismo y no se inicia sesión (esc. 2)',
    async (http, codigo) => {
      responderUnaVez(cuerpoError(codigo), http);
      const iniciarSesion = vi.fn(() => true);

      const estado = await intentarIngreso(credenciales, iniciarSesion);

      expect(estado).toEqual({ tipo: 'fallido', mensaje: MENSAJES_INGRESO.credenciales });
      expect(iniciarSesion).not.toHaveBeenCalled();
    },
  );

  it('si la API entrega un token que no es de un usuario interno, no entra y el mensaje es el mismo', async () => {
    responderUnaVez({ data: sesionDePrueba('estudiante'), error: null, meta: null });

    const estado = await intentarIngreso(credenciales, () => false);

    expect(estado).toEqual({ tipo: 'fallido', mensaje: MENSAJES_INGRESO.credenciales });
  });

  it('muestra el límite de intentos del servidor con un mensaje claro', async () => {
    responderUnaVez(cuerpoError('DEMASIADOS_INTENTOS'), 429);

    const estado = await intentarIngreso(credenciales, () => true);

    expect(estado).toEqual({ tipo: 'fallido', mensaje: MENSAJES_INGRESO.intentos });
  });
});

describe('mensajeErrorIngreso', () => {
  it('traduce cada error a un mensaje en español sin datos técnicos', () => {
    expect(mensajeErrorIngreso(new ErrorApi(400, 'VALIDACION', 'x'))).toBe(MENSAJES_INGRESO.datos);
    expect(mensajeErrorIngreso(new ErrorApi(501, 'NO_IMPLEMENTADO', 'x'))).toBe(
      MENSAJES_INGRESO.general,
    );
    expect(mensajeErrorIngreso(new Error('x'))).toBe(MENSAJES_INGRESO.general);
  });

  it('una cuenta desactivada recibe su propio aviso, no el de credenciales incorrectas', () => {
    const error = new ErrorApi(403, 'CUENTA_DESACTIVADA', 'x');

    expect(mensajeErrorIngreso(error)).toBe(MENSAJES_INGRESO.desactivada);
    expect(MENSAJES_INGRESO.desactivada).toMatch(/administrador/);
  });

  it('sin conexión usa el mensaje del cliente', () => {
    const error = new ErrorApi(0, 'SIN_CONEXION', 'No se pudo conectar con la API.');

    expect(mensajeErrorIngreso(error)).toBe('No se pudo conectar con la API.');
  });
});
