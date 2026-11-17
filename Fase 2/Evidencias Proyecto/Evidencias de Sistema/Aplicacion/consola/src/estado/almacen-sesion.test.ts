import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  instalarAlmacen,
  sesionDePrueba,
  tokenConsola,
  tokenDePrueba,
  UNA_HORA,
} from '../pruebas/sesion';
import {
  abrirSesion,
  borrarSesion,
  leerSesionGuardada,
  usuarioDelToken,
  usuarioGuardado,
} from './almacen-sesion';

afterEach(() => {
  vi.unstubAllGlobals();
});

const vigente = () => Math.floor(Date.now() / 1000) + UNA_HORA;

describe('usuarioDelToken', () => {
  it('lee el usuario y el rol de un token de la consola', () => {
    expect(usuarioDelToken(tokenConsola('docente', 'd-7'))).toEqual({ id: 'd-7', rol: 'docente' });
    expect(usuarioDelToken(tokenConsola('admin'))).toEqual({ id: 'u-1', rol: 'admin' });
  });

  it('rechaza un token de la app (HU-03 esc. 2: un estudiante no entra a la consola)', () => {
    const tokenApp = tokenDePrueba({ sub: 'e-1', aud: 'app', exp: vigente() });

    expect(usuarioDelToken(tokenApp)).toBeNull();
  });

  it('rechaza un rol que no es interno, un token vencido y uno mal formado', () => {
    expect(usuarioDelToken(tokenConsola('estudiante'))).toBeNull();
    expect(usuarioDelToken(tokenConsola('editor'))).toBeNull();
    const vencido = tokenDePrueba({ sub: 'u', rol: 'admin', aud: 'admin', exp: 1 });
    expect(usuarioDelToken(vencido)).toBeNull();
    expect(usuarioDelToken('no-es-un-token')).toBeNull();
    expect(usuarioDelToken('a.%%%.c')).toBeNull();
  });
});

describe('sesión guardada', () => {
  it('abre la sesión de un usuario interno y la guarda', () => {
    instalarAlmacen();
    const sesion = sesionDePrueba('admin');

    expect(abrirSesion(sesion)).toEqual({ id: 'u-1', rol: 'admin' });
    expect(leerSesionGuardada()).toEqual(sesion);
    expect(usuarioGuardado()).toEqual({ id: 'u-1', rol: 'admin' });
  });

  it('no guarda una sesión que no es de la consola', () => {
    const datos = instalarAlmacen();

    expect(abrirSesion(sesionDePrueba('estudiante'))).toBeNull();
    expect(datos.size).toBe(0);
  });

  it('al cerrar sesión borra los tokens', () => {
    const datos = instalarAlmacen();
    abrirSesion(sesionDePrueba('docente'));

    borrarSesion();

    expect(datos.size).toBe(0);
    expect(usuarioGuardado()).toBeNull();
  });

  it('una sesión guardada ya vencida no cuenta', () => {
    instalarAlmacen();
    abrirSesion(sesionDePrueba('admin'));

    expect(usuarioGuardado(Date.now() + 2 * UNA_HORA * 1000)).toBeNull();
  });

  it('funciona sin almacenamiento disponible', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
    });

    expect(abrirSesion(sesionDePrueba('admin'))).toEqual({ id: 'u-1', rol: 'admin' });
    expect(leerSesionGuardada()).toBeNull();
    expect(() => borrarSesion()).not.toThrow();
  });
});
