// Ayudantes de las pruebas de recuperación de la contraseña con PostgreSQL real (HU-06, CU-04): pedir el
// enlace, leerlo del correo y crear la contraseña nueva. Cada archivo de pruebas crea una app nueva por
// prueba (los límites de la recuperación empiezan en cero) y la entrega con `obtenerApp`.
import type { Express } from 'express';
import request from 'supertest';
import type { EntornoSesiones } from './base-sesiones.js';
import { RUTA_INGRESO_APP } from './escenario-sesiones.js';

export const SOLICITAR = '/api/v1/app/cuentas/recuperacion/solicitar';
export const RESTABLECER = '/api/v1/app/cuentas/recuperacion/restablecer';
export const HORA_EN_SEGUNDOS = 3600;
export const CLAVE_VIEJA = 'clave-vieja-del-sur';
export const CLAVE_NUEVA = 'tranquilo-del-norte-9';
export const EVA = { correo: 'eva@ejemplo.cl', contrasena: CLAVE_VIEJA };

const enlaceDe = (texto: string | undefined) =>
  /\/restablecer-contrasena\?token=([\w-]+)/.exec(texto ?? '')?.[1] ?? '';

export function crearAyudantesDeRecuperacion(entorno: EntornoSesiones, obtenerApp: () => Express) {
  const solicitar = (correo: string, ip = '203.0.113.1') =>
    request(obtenerApp()).post(SOLICITAR).set('X-Forwarded-For', ip).send({ correo });
  const restablecer = (token: string, contrasena = CLAVE_NUEVA) =>
    request(obtenerApp()).post(RESTABLECER).send({ token, contrasena });
  const ingresar = (correo: string, contrasena: string) =>
    request(obtenerApp()).post(RUTA_INGRESO_APP).send({ correo, contrasena });

  /** Pide la recuperación, espera el correo y devuelve su enlace. */
  async function pedirEnlace(correo = EVA.correo, ip = '203.0.113.1') {
    const antes = entorno.correos.length;
    const respuesta = await solicitar(correo, ip);
    await entorno.esperarSegundoPlano();
    const mensaje = entorno.correos[antes];
    return { respuesta, mensaje, token: enlaceDe(mensaje?.texto) };
  }

  return { solicitar, restablecer, ingresar, pedirEnlace };
}
