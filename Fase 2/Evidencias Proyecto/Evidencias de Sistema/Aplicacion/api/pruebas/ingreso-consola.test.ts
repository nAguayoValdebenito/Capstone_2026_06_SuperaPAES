// Ingreso, renovación y cierre de la sesión de la consola (CU-03, HU-03, RNF-01) sobre los repositorios
// en memoria del escenario de sesiones, sin PostgreSQL. Las consultas reales se prueban en
// usuarios-internos-bd.test.ts y sesion-consola-bd.test.ts.
// Escrita por Catalina con la primera versión de la sesión de la consola (#6 y #7) y adaptada a la
// sesión revocable: mismos casos y mismas expectativas, con el escenario de escenario-sesiones.ts.
import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { verificarToken } from '../comun/jwt.js';
import type { SesionIniciada } from '../modulos/cuentas/cuentas.servicio.js';
import { errorConFormato, SECRETO_DE_PRUEBA } from './ayudantes.js';
import { crearEscenarioSesiones } from './escenario-sesiones.js';

const RUTA = '/api/v1/admin/cuentas';
const CLAVE = 'clave-de-la-admin';
const CREDENCIALES_INCORRECTAS = 'Correo o contraseña incorrectos.';

/** Una administradora y una docente activas, con la misma contraseña. */
async function crearEscenario() {
  const escenario = crearEscenarioSesiones();
  const adminId = await escenario.crearCuenta({
    correo: 'admin@ejemplo.cl',
    contrasena: CLAVE,
    rol: 'admin',
  });
  const docenteId = await escenario.crearCuenta({
    correo: 'docente@ejemplo.cl',
    contrasena: CLAVE,
    rol: 'docente',
  });
  const cuenta = (id: string) => escenario.usuarios.get(id);
  const sesiones = () => [...escenario.sesiones.values()];
  return { ...escenario, adminId, docenteId, cuenta, sesiones };
}

const ingresar = (app: Express, correo: string, contrasena = CLAVE) =>
  request(app)
    .post(`${RUTA}/ingreso`)
    .set('User-Agent', 'Navegador de prueba')
    .send({ correo, contrasena });

/** La sesión que trae una respuesta exitosa del ingreso o de la renovación. */
const sesionDe = (respuesta: request.Response) => respuesta.body.data as SesionIniciada;

/** Datos del token de acceso de la consola. */
const claimsDe = (respuesta: request.Response, ahora: Date) =>
  verificarToken('admin', sesionDe(respuesta).tokenAcceso, SECRETO_DE_PRUEBA, ahora);

describe('ingreso a la consola (CU-03, HU-03)', () => {
  it('con correo y contraseña correctos entrega un token de la consola con el rol de la cuenta', async () => {
    const escenario = await crearEscenario();

    const respuesta = await ingresar(escenario.app, 'Docente@Ejemplo.cl');

    expect(respuesta.status).toBe(200);
    const { tokenRenovacion } = sesionDe(respuesta);
    expect(await claimsDe(respuesta, escenario.ahora())).toMatchObject({
      sub: escenario.docenteId,
      rol: 'docente',
    });
    // La credencial de renovación solo se guarda cifrada, con el navegador y el último acceso.
    const sesiones = escenario.sesiones();
    expect(sesiones).toHaveLength(1);
    expect(sesiones[0]?.hashToken).toMatch(/^[0-9a-f]{64}$/);
    expect(sesiones[0]?.hashToken).not.toContain(tokenRenovacion);
    expect(sesiones[0]?.dispositivo).toBe('Navegador de prueba');
    expect(escenario.cuenta(escenario.docenteId)?.ultimoAcceso).toEqual(escenario.ahora());
  });

  it.each([
    ['una contraseña incorrecta', 'admin@ejemplo.cl', 'otra-clave-cualquiera'],
    [
      'un correo sin cuenta interna, como el de un estudiante (HU-03 esc. 2)',
      'ana@ejemplo.cl',
      CLAVE,
    ],
  ])('%s recibe 401 con el mensaje genérico y sin sesión', async (_caso, correo, contrasena) => {
    const escenario = await crearEscenario();

    const respuesta = await ingresar(escenario.app, correo, contrasena);

    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual(errorConFormato('NO_AUTENTICADO'));
    expect(respuesta.body.error.mensaje).toBe(CREDENCIALES_INCORRECTAS);
    expect(escenario.sesiones()).toHaveLength(0);
    expect(escenario.cuenta(escenario.adminId)?.ultimoAcceso).toBeNull();
  });

  it('una cuenta desactivada con la contraseña correcta no entra y se le pide contactar a un administrador (CU-23 3.b)', async () => {
    const escenario = await crearEscenario();
    const cuenta = escenario.cuenta(escenario.adminId);
    if (cuenta) cuenta.activo = false;

    const respuesta = await ingresar(escenario.app, 'admin@ejemplo.cl');

    expect(respuesta.status).toBe(403);
    expect(respuesta.body).toEqual(errorConFormato('CUENTA_DESACTIVADA'));
    expect(respuesta.body.error.mensaje).toMatch(/desactivada.*administrador/);
    expect(escenario.sesiones()).toHaveLength(0);
    expect(cuenta?.ultimoAcceso).toBeNull();
  });

  it('una cuenta desactivada con una contraseña incorrecta recibe el mensaje genérico', async () => {
    const escenario = await crearEscenario();
    const cuenta = escenario.cuenta(escenario.adminId);
    if (cuenta) cuenta.activo = false;

    const respuesta = await ingresar(escenario.app, 'admin@ejemplo.cl', 'otra-clave-cualquiera');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.mensaje).toBe(CREDENCIALES_INCORRECTAS);
  });
});

describe('renovación y cierre de la sesión de la consola (RNF-01, CU-03)', () => {
  async function conSesion(correo = 'admin@ejemplo.cl') {
    const escenario = await crearEscenario();
    const { tokenRenovacion } = sesionDe(await ingresar(escenario.app, correo));
    return { ...escenario, tokenRenovacion };
  }

  const renovar = (app: Express, tokenRenovacion: string, navegador = 'Navegador de prueba') =>
    request(app).post(`${RUTA}/renovar`).set('User-Agent', navegador).send({ tokenRenovacion });

  it('renueva con una credencial nueva y la anterior deja de servir', async () => {
    const escenario = await conSesion();

    const renovada = await renovar(escenario.app, escenario.tokenRenovacion);
    expect(renovada.status).toBe(200);
    expect(sesionDe(renovada).tokenRenovacion).not.toBe(escenario.tokenRenovacion);
    expect(await claimsDe(renovada, escenario.ahora())).toMatchObject({
      sub: escenario.adminId,
      rol: 'admin',
    });

    const repetida = await renovar(escenario.app, escenario.tokenRenovacion);
    expect(repetida.status).toBe(401);
    expect(repetida.body).toEqual(errorConFormato('NO_AUTENTICADO'));
  });

  it('el token renovado lleva el rol que la cuenta tiene hoy', async () => {
    const escenario = await conSesion('docente@ejemplo.cl');
    const cuenta = escenario.cuenta(escenario.docenteId);
    if (cuenta) cuenta.rol = 'admin';

    const renovada = await renovar(escenario.app, escenario.tokenRenovacion);

    expect((await claimsDe(renovada, escenario.ahora()))?.rol).toBe('admin');
  });

  it('la sesión renovada guarda el navegador de la petición', async () => {
    const escenario = await conSesion();

    await renovar(escenario.app, escenario.tokenRenovacion, 'Otro navegador');

    expect(escenario.sesiones().map((s) => s.dispositivo)).toEqual([
      'Navegador de prueba',
      'Otro navegador',
    ]);
  });

  it('una cuenta desactivada no renueva su sesión', async () => {
    const escenario = await conSesion();
    const cuenta = escenario.cuenta(escenario.adminId);
    if (cuenta) cuenta.activo = false;

    expect((await renovar(escenario.app, escenario.tokenRenovacion)).status).toBe(401);
  });

  it('una credencial desconocida no renueva', async () => {
    const { app } = await crearEscenario();

    expect((await renovar(app, 'credencial-inventada')).status).toBe(401);
  });

  it('después de cerrar la sesión, su credencial ya no renueva', async () => {
    const escenario = await conSesion();

    const cierre = await request(escenario.app)
      .post(`${RUTA}/cerrar`)
      .send({ tokenRenovacion: escenario.tokenRenovacion });

    expect(cierre.status).toBe(200);
    expect(cierre.body.data).toEqual({ sesionCerrada: true });
    expect(escenario.sesiones()[0]?.revocadoEn).not.toBeNull();
    expect((await renovar(escenario.app, escenario.tokenRenovacion)).status).toBe(401);
  });

  it('cerrar con una credencial desconocida responde igual, sin revelar nada', async () => {
    const { app } = await crearEscenario();

    const cierre = await request(app)
      .post(`${RUTA}/cerrar`)
      .send({ tokenRenovacion: 'credencial-inventada' });

    expect(cierre.status).toBe(200);
  });
});
