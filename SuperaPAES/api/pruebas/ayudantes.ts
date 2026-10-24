// Ayudantes de prueba: dependencias falsas para crear la app sin base de datos real.
import type { Express } from 'express';
import { expect } from 'vitest';
import { crearApp, crearServicios, type Dependencias, type Servicios } from '../app.js';
import { FabricaProveedores } from '../adaptadores/fabrica.js';
import { firmarToken } from '../comun/jwt.js';
import { relojDelSistema } from '../comun/reloj.js';
import type { RolCuentaInterna } from '../comun/roles.js';
import { DURACION_TOKEN_ACCESO_SEGUNDOS } from '../modulos/cuentas/cuentas.servicio.js';

export const SECRETO_DE_PRUEBA = 'secreto-de-prueba-con-mas-de-32-caracteres';
export const SECRETO_APP_DE_PRUEBA = `${SECRETO_DE_PRUEBA}-app`;

const sinBase = () => Promise.reject(new Error('Las pruebas de la API no usan una base real.'));

export function crearDependenciasDePrueba(cambios: Partial<Dependencias> = {}): Dependencias {
  return {
    bd: { query: sinBase },
    unidadDeTrabajo: { enTransaccion: sinBase },
    comprobarBaseDeDatos: () => Promise.resolve(),
    proveedores: FabricaProveedores.crear(
      {
        ia: { proveedor: 'simulado' },
        correo: { proveedor: 'consola' },
        pagos: { proveedor: 'simulado' },
      },
      relojDelSistema,
    ),
    reloj: relojDelSistema,
    jwt: { secretoConsola: SECRETO_DE_PRUEBA, secretoApp: SECRETO_APP_DE_PRUEBA },
    corsOrigenes: ['http://localhost:5173'],
    registrarPeticiones: false,
    ...cambios,
  };
}

/**
 * Sin base, la app no puede consultar app.token_sesion: estas apps aceptan la sesión de cualquier
 * token bien firmado. La sesión real se prueba en sesion-consola.test.ts y sesion-consola-bd.test.ts.
 */
export function aceptarCualquierSesion(servicios: Servicios): Servicios {
  return {
    ...servicios,
    cuentas: { ...servicios.cuentas, sesionVigente: () => Promise.resolve(true) },
  };
}

/** App sin base que acepta cualquier sesión, con servicios reemplazados si hace falta. */
export function crearAppDePrueba(
  cambios: Partial<Dependencias> = {},
  servicios: Partial<Servicios> = {},
): Express {
  const dependencias = crearDependenciasDePrueba(cambios);
  return crearApp(
    dependencias,
    aceptarCualquierSesion({ ...crearServicios(dependencias), ...servicios }),
  );
}

const vigenciaDePrueba = () => ({ desde: new Date(), segundos: DURACION_TOKEN_ACCESO_SEGUNDOS });

export function tokenApp(estudianteId = '10'): Promise<string> {
  return firmarToken(
    'app',
    { sub: estudianteId, sid: '1' },
    SECRETO_APP_DE_PRUEBA,
    vigenciaDePrueba(),
  );
}

export function tokenAdmin(rol: RolCuentaInterna = 'admin', usuarioId = '1'): Promise<string> {
  return firmarToken(
    'admin',
    { sub: usuarioId, sid: '1', rol },
    SECRETO_DE_PRUEBA,
    vigenciaDePrueba(),
  );
}

export function cuerpoRegistro(cambios: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    nombre: 'Ana',
    correo: 'ana@ejemplo.cl',
    contrasena: 'una-clave-larga',
    aceptaTerminos: true,
    aceptaPrivacidad: true,
    declaraTenerCatorceAnios: true,
    ...cambios,
  };
}

export function cuerpoIngreso(cambios: Record<string, unknown> = {}): Record<string, unknown> {
  return { correo: 'ana@ejemplo.cl', contrasena: 'clave', ...cambios };
}

// Forma común de error de la API: { data: null, error: { codigo, mensaje }, meta: null }.
export function errorConFormato(codigo: string) {
  return {
    data: null,
    error: { codigo, mensaje: expect.any(String) as string },
    meta: null,
  };
}
