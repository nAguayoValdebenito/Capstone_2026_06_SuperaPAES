import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorApi } from '../api/cliente';
import { primeraLlamada, responderUnaVez } from '../pruebas/sesion';
import {
  estadoDeErrorCambio,
  intentarCambio,
  MENSAJES_CAMBIO,
  validarCambio,
} from './cambiar-contrasena';
import { MENSAJES_RESTABLECER } from './restablecer-contrasena';

const cuerpoError = (codigo: string, mensaje: string, detalles?: unknown) => ({
  data: null,
  error: { codigo, mensaje, detalles },
  meta: null,
});

const datos = (cambios: Partial<Record<'actual' | 'nueva' | 'repeticion', string>> = {}) => ({
  actual: 'clave-asignada-1',
  nueva: 'mi clave propia',
  repeticion: 'mi clave propia',
  ...cambios,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('validarCambio (Cambia tu contraseña)', () => {
  it('pide la actual, los mismos requisitos de RN-31 que Nueva contraseña y una nueva distinta', () => {
    expect(validarCambio(datos({ actual: '' }))).toEqual({
      tipo: 'fallido',
      mensaje: MENSAJES_CAMBIO.faltaActual,
      campo: 'actual',
    });
    expect(validarCambio(datos({ nueva: 'corta', repeticion: 'corta' }))).toMatchObject({
      mensaje: 'La contraseña debe tener al menos 8 caracteres.',
      campo: 'nueva',
    });
    expect(validarCambio(datos({ repeticion: 'otra clave larga' }))).toMatchObject({
      mensaje: MENSAJES_RESTABLECER.noCoinciden,
      campo: 'nueva',
    });
    expect(
      validarCambio(datos({ nueva: 'clave-asignada-1', repeticion: 'clave-asignada-1' })),
    ).toMatchObject({ mensaje: MENSAJES_CAMBIO.igualActual, campo: 'nueva' });
    expect(validarCambio(datos())).toBeNull();
  });
});

describe('cambiar la contraseña', () => {
  it('envía la actual y la nueva a /admin/cuentas/contrasena (sin la repetición)', async () => {
    responderUnaVez({ data: { contrasenaCambiada: true }, error: null, meta: null });

    const estado = await intentarCambio(datos());

    expect(estado).toEqual({ tipo: 'cambiada' });
    const llamada = primeraLlamada();
    expect(llamada.url).toBe('/admin/cuentas/contrasena');
    expect(llamada.metodo).toBe('POST');
    expect(JSON.parse(llamada.cuerpo as string)).toEqual({
      actual: 'clave-asignada-1',
      nueva: 'mi clave propia',
    });
  });

  it('con un problema local no llama a la API', async () => {
    const fetchFalso = responderUnaVez({ data: null, error: null, meta: null });

    await intentarCambio(datos({ actual: '' }));

    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('la contraseña actual incorrecta (401) va bajo su campo con el mensaje de la API', async () => {
    responderUnaVez(cuerpoError('NO_AUTENTICADO', 'La contraseña actual no es correcta.'), 401);

    expect(await intentarCambio(datos())).toEqual({
      tipo: 'fallido',
      mensaje: 'La contraseña actual no es correcta.',
      campo: 'actual',
    });
  });

  it('un rechazo de RN-31 de la API va bajo la contraseña nueva', async () => {
    const detalles = [
      { lugar: 'cuerpo', ruta: 'nueva', mensaje: 'Esa contraseña es muy común.', motivo: 'x' },
    ];
    responderUnaVez(cuerpoError('VALIDACION', 'Los datos no son válidos.', detalles), 400);

    expect(await intentarCambio(datos())).toEqual({
      tipo: 'fallido',
      mensaje: 'Esa contraseña es muy común.',
      campo: 'nueva',
    });
  });

  it('demasiados intentos y los demás errores son avisos generales', () => {
    const intentos = new ErrorApi(429, 'DEMASIADOS_INTENTOS', 'Hiciste demasiados intentos.');

    expect(estadoDeErrorCambio(intentos)).toEqual({
      tipo: 'fallido',
      mensaje: 'Hiciste demasiados intentos.',
      campo: null,
    });
    expect(estadoDeErrorCambio(new ErrorApi(500, 'ERROR_INTERNO', 'x'))).toEqual({
      tipo: 'fallido',
      mensaje: MENSAJES_CAMBIO.general,
      campo: null,
    });
    expect(estadoDeErrorCambio(new Error('otro'))).toMatchObject({ campo: null });
  });
});
