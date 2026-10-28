// Ayudantes de prueba: dependencias falsas para crear la app sin base de datos real.
import type { Express } from 'express';
import { expect } from 'vitest';
import { crearApp, crearServicios, type Dependencias, type Servicios } from '../app.js';
import { FabricaProveedores } from '../adaptadores/fabrica.js';
import { firmarToken } from '../comun/jwt.js';
import { relojDelSistema } from '../comun/reloj.js';
import type { RolCuentaInterna } from '../comun/roles.js';
import { DURACION_TOKEN_ACCESO_SEGUNDOS } from '../modulos/cuentas/cuentas.servicio.js';
import type { PruebaTemario, TemarioServicio } from '../modulos/temario/index.js';

export const SECRETO_DE_PRUEBA = 'secreto-de-prueba-con-mas-de-32-caracteres';
export const SECRETO_APP_DE_PRUEBA = `${SECRETO_DE_PRUEBA}-app`;
export const CLAVE_CODIGO_DE_PRUEBA = `${SECRETO_DE_PRUEBA}-codigo-correo`;
export const URL_CONSOLA_DE_PRUEBA = 'http://localhost:5173';

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
    verificacionCorreo: { urlConsola: URL_CONSOLA_DE_PRUEBA, claveCodigo: CLAVE_CODIGO_DE_PRUEBA },
    corsOrigenes: [URL_CONSOLA_DE_PRUEBA],
    registrarPeticiones: false,
    // Sin base: la cuenta del token se da por vigente. Las pruebas de la separación de roles la cambian.
    verificarCuentaInterna: () => Promise.resolve(true),
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
    declaraTenerCatorceAnios: true,
    documentosAceptados: [1, 2],
    ...cambios,
  };
}

export function cuerpoIngreso(cambios: Record<string, unknown> = {}): Record<string, unknown> {
  return { correo: 'ana@ejemplo.cl', contrasena: 'clave', ...cambios };
}

/** Temario sin base para las pruebas de preguntas: entrega `temario` y nada de la app. */
export function temarioEnMemoria(temario: PruebaTemario[]): TemarioServicio {
  return {
    listarAreas: () => Promise.resolve([]),
    alcancePracticaValido: () => Promise.resolve(true),
    listarTemario: () => Promise.resolve(temario),
    opcionesPerfil: () => Promise.resolve({ cursos: [], pruebas: [], areasCarrera: [] }),
    opcionesPractica: () => Promise.resolve({ dificultades: [], pruebas: [] }),
  };
}

// Forma común de error de la API: { data: null, error: { codigo, mensaje }, meta: null }.
export function errorConFormato(codigo: string) {
  return {
    data: null,
    error: { codigo, mensaje: expect.any(String) as string },
    meta: null,
  };
}
