// Ayudantes de las pruebas de verificación del correo con PostgreSQL real (HU-05, RN-32): un estudiante
// con sesión de la app, pedir el correo de verificación y leer de él el enlace y el código.
import request from 'supertest';
import { expect } from 'vitest';
import type { MensajeCorreo } from '../adaptadores/fabrica.js';
import type { EntornoSesiones } from './base-sesiones.js';
import { conToken, RUTA_INGRESO_APP } from './escenario-sesiones.js';
import { crearEstudianteDePrueba, type EstudianteDePrueba } from './estudiantes-de-prueba.js';

export const RUTA_ENLACE = '/api/v1/app/cuentas/verificacion/enlace';
export const RUTA_REENVIAR = '/api/v1/app/cuentas/verificacion/reenviar';
export const HORAS_VERIFICACION = 24;

/** Enlace (token de /verificar-correo?token=) y código de 6 dígitos de un correo de verificación. */
export function leerCorreo(mensaje: MensajeCorreo | undefined): { token: string; codigo: string } {
  const token = /\/verificar-correo\?token=([\w-]+)/.exec(mensaje?.texto ?? '')?.[1];
  const codigo = /código en la app: (\d{6})/.exec(mensaje?.texto ?? '')?.[1];
  if (!token || !codigo) throw new Error('El correo no trae el enlace y el código esperados.');
  return { token, codigo };
}

let siguiente = 0;

/** Estudiante sin verificar que ya inició sesión en la app. */
export async function estudianteConSesion(
  entorno: EntornoSesiones,
  datos: Partial<EstudianteDePrueba> = {},
) {
  siguiente += 1;
  const cuenta = {
    correo: `estudiante${String(siguiente)}@ejemplo.cl`,
    contrasena: 'clave-de-prueba-1',
    ...datos,
  };
  const id = await crearEstudianteDePrueba(entorno.bd, cuenta);
  const ingreso = await request(entorno.app).post(RUTA_INGRESO_APP).send(cuenta);
  expect(ingreso.status).toBe(200);
  const tokenAcceso = ingreso.body.data.tokenAcceso as string;
  return { id, correo: cuenta.correo, sesion: conToken(tokenAcceso) };
}

/** Pide (o vuelve a pedir) el correo de verificación y devuelve su enlace y su código. */
export async function pedirCorreo(
  entorno: EntornoSesiones,
  sesion: Record<string, string>,
  app = entorno.app,
) {
  const respuesta = await request(app).post(RUTA_REENVIAR).set(sesion);
  return { respuesta, ...leerCorreo(entorno.correos.at(-1)) };
}

/** Verifica con el enlace, sin sesión (como la página /verificar-correo de la consola). */
export function verificarConEnlace(entorno: EntornoSesiones, token: string) {
  return request(entorno.app).post(RUTA_ENLACE).send({ token });
}
