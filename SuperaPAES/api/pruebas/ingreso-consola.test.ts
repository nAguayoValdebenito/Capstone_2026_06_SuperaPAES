// Ingreso, renovación y cierre de la sesión de la consola (CU-03, HU-03, RNF-01) sobre un repositorio
// en memoria, sin PostgreSQL. Las consultas reales se prueban en usuarios-internos-bd.test.ts.
import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { crearApp, crearServicios } from '../app.js';
import { cifrarContrasena } from '../comun/contrasenas.js';
import { verificarToken } from '../comun/jwt.js';
import type { UnidadDeTrabajo } from '../db/transaccion.js';
import type {
  CuentaParaIngreso,
  CuentasRepositorio,
} from '../modulos/cuentas/cuentas.repositorio.js';
import { crearCuentasServicio } from '../modulos/cuentas/index.js';
import type { SesionIniciada } from '../modulos/cuentas/cuentas.servicio.js';
import { crearDependenciasDePrueba, errorConFormato, SECRETO_DE_PRUEBA } from './ayudantes.js';

const RUTA = '/api/v1/admin/cuentas';
const CLAVE = 'clave-de-la-admin';
const CREDENCIALES_INCORRECTAS = 'Correo o contraseña incorrectos.';

interface SesionGuardada {
  id: string;
  usuarioInternoId: string;
  hashToken: string;
  dispositivo: string | null;
  revocada: boolean;
}

let hashClave: string;
beforeAll(async () => {
  hashClave = await cifrarContrasena(CLAVE);
});

/** Cuentas por correo y sesiones en memoria, con las mismas reglas que las consultas reales. */
function crearEscenario() {
  const cuentas = new Map<string, CuentaParaIngreso>([
    ['admin@ejemplo.cl', { id: '1', rol: 'admin', activo: true, hashContrasena: hashClave }],
    ['docente@ejemplo.cl', { id: '2', rol: 'docente', activo: true, hashContrasena: hashClave }],
  ]);
  const sesiones: SesionGuardada[] = [];
  const accesos: string[] = [];
  const cuentaPorId = (id: string) => [...cuentas.values()].find((c) => c.id === id);
  const repositorio: CuentasRepositorio = {
    buscarCuentaInternaPorCorreo: (correo) =>
      Promise.resolve(cuentas.get(correo.toLowerCase()) ?? null),
    registrarAccesoInterno: (id) => {
      accesos.push(id);
      return Promise.resolve();
    },
    crearSesionInterna: ({ usuarioInternoId, hashToken, dispositivo }) => {
      const id = String(sesiones.length + 1);
      sesiones.push({ id, usuarioInternoId, hashToken, dispositivo, revocada: false });
      return Promise.resolve();
    },
    buscarSesionInterna: (hashToken) => {
      const sesion = sesiones.find((s) => s.hashToken === hashToken);
      const cuenta = sesion && cuentaPorId(sesion.usuarioInternoId);
      if (!sesion || !cuenta) return Promise.resolve(null);
      const { id, usuarioInternoId, revocada } = sesion;
      return Promise.resolve({
        id,
        usuarioInternoId,
        rol: cuenta.rol,
        activo: cuenta.activo,
        vigente: !revocada,
      });
    },
    revocarSesion: (id) => {
      const sesion = sesiones.find((s) => s.id === id);
      if (sesion) sesion.revocada = true;
      return Promise.resolve();
    },
  };
  const unidadDeTrabajo: UnidadDeTrabajo = {
    enTransaccion: (trabajo) => trabajo({ query: () => Promise.reject(new Error('sin base')) }),
  };
  const dependencias = crearDependenciasDePrueba({ unidadDeTrabajo });
  const servicios = crearServicios(dependencias);
  const cuentasServicio = crearCuentasServicio({
    bd: dependencias.bd,
    unidadDeTrabajo,
    correo: dependencias.proveedores.correo,
    administracion: servicios.administracion,
    secretoConsola: SECRETO_DE_PRUEBA,
    repositorio,
  });
  const app = crearApp(dependencias, { ...servicios, cuentas: cuentasServicio });
  return { app, cuentas, sesiones, accesos };
}

const ingresar = (app: Express, correo: string, contrasena = CLAVE) =>
  request(app)
    .post(`${RUTA}/ingreso`)
    .set('User-Agent', 'Navegador de prueba')
    .send({ correo, contrasena });

/** La sesión que trae una respuesta exitosa del ingreso o de la renovación. */
const sesionDe = (respuesta: request.Response) => respuesta.body.data as SesionIniciada;

/** Datos del token de acceso de la consola. */
const claimsDe = (respuesta: request.Response) =>
  verificarToken('admin', sesionDe(respuesta).tokenAcceso, SECRETO_DE_PRUEBA);

describe('ingreso a la consola (CU-03, HU-03)', () => {
  it('con correo y contraseña correctos entrega un token de la consola con el rol de la cuenta', async () => {
    const { app, sesiones, accesos } = crearEscenario();

    const respuesta = await ingresar(app, 'Docente@Ejemplo.cl');

    expect(respuesta.status).toBe(200);
    const { tokenRenovacion } = sesionDe(respuesta);
    expect(await claimsDe(respuesta)).toEqual({ sub: '2', rol: 'docente' });
    // La credencial de renovación solo se guarda cifrada, con el navegador y el último acceso.
    expect(sesiones).toHaveLength(1);
    expect(sesiones[0]?.hashToken).toMatch(/^[0-9a-f]{64}$/);
    expect(sesiones[0]?.hashToken).not.toContain(tokenRenovacion);
    expect(sesiones[0]?.dispositivo).toBe('Navegador de prueba');
    expect(accesos).toEqual(['2']);
  });

  it.each([
    ['una contraseña incorrecta', 'admin@ejemplo.cl', 'otra-clave-cualquiera'],
    [
      'un correo sin cuenta interna, como el de un estudiante (HU-03 esc. 2)',
      'ana@ejemplo.cl',
      CLAVE,
    ],
  ])('%s recibe 401 con el mensaje genérico y sin sesión', async (_caso, correo, contrasena) => {
    const { app, sesiones, accesos } = crearEscenario();

    const respuesta = await ingresar(app, correo, contrasena);

    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual(errorConFormato('NO_AUTENTICADO'));
    expect(respuesta.body.error.mensaje).toBe(CREDENCIALES_INCORRECTAS);
    expect(sesiones).toHaveLength(0);
    expect(accesos).toHaveLength(0);
  });

  it('una cuenta desactivada no entra, aunque la contraseña sea correcta (CU-23 3.b)', async () => {
    const { app, cuentas, sesiones } = crearEscenario();
    const cuenta = cuentas.get('admin@ejemplo.cl');
    if (cuenta) cuenta.activo = false;

    const respuesta = await ingresar(app, 'admin@ejemplo.cl');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.mensaje).toBe(CREDENCIALES_INCORRECTAS);
    expect(sesiones).toHaveLength(0);
  });
});

describe('renovación y cierre de la sesión de la consola (RNF-01, CU-03)', () => {
  async function conSesion(correo = 'admin@ejemplo.cl') {
    const escenario = crearEscenario();
    const { tokenRenovacion } = sesionDe(await ingresar(escenario.app, correo));
    return { ...escenario, tokenRenovacion };
  }

  const renovar = (app: Express, tokenRenovacion: string) =>
    request(app).post(`${RUTA}/renovar`).send({ tokenRenovacion });

  it('renueva con una credencial nueva y la anterior deja de servir', async () => {
    const { app, tokenRenovacion } = await conSesion();

    const renovada = await renovar(app, tokenRenovacion);
    expect(renovada.status).toBe(200);
    expect(sesionDe(renovada).tokenRenovacion).not.toBe(tokenRenovacion);
    expect(await claimsDe(renovada)).toEqual({ sub: '1', rol: 'admin' });

    const repetida = await renovar(app, tokenRenovacion);
    expect(repetida.status).toBe(401);
    expect(repetida.body).toEqual(errorConFormato('NO_AUTENTICADO'));
  });

  it('el token renovado lleva el rol que la cuenta tiene hoy', async () => {
    const { app, cuentas, tokenRenovacion } = await conSesion('docente@ejemplo.cl');
    const cuenta = cuentas.get('docente@ejemplo.cl');
    if (cuenta) cuenta.rol = 'admin';

    const renovada = await renovar(app, tokenRenovacion);

    expect((await claimsDe(renovada))?.rol).toBe('admin');
  });

  it('una cuenta desactivada no renueva su sesión', async () => {
    const { app, cuentas, tokenRenovacion } = await conSesion();
    const cuenta = cuentas.get('admin@ejemplo.cl');
    if (cuenta) cuenta.activo = false;

    expect((await renovar(app, tokenRenovacion)).status).toBe(401);
  });

  it('una credencial desconocida no renueva', async () => {
    const { app } = crearEscenario();

    expect((await renovar(app, 'credencial-inventada')).status).toBe(401);
  });

  it('después de cerrar la sesión, su credencial ya no renueva', async () => {
    const { app, sesiones, tokenRenovacion } = await conSesion();

    const cierre = await request(app).post(`${RUTA}/cierre`).send({ tokenRenovacion });

    expect(cierre.status).toBe(200);
    expect(cierre.body.data).toEqual({ cerrada: true });
    expect(sesiones[0]?.revocada).toBe(true);
    expect((await renovar(app, tokenRenovacion)).status).toBe(401);
  });

  it('cerrar con una credencial desconocida responde igual, sin revelar nada', async () => {
    const { app } = crearEscenario();

    const cierre = await request(app)
      .post(`${RUTA}/cierre`)
      .send({ tokenRenovacion: 'credencial-inventada' });

    expect(cierre.status).toBe(200);
  });
});
