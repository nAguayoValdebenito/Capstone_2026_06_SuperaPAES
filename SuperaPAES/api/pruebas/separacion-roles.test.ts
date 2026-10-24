// Separación de roles de la consola (HU-03 esc. 3, CU-23 3.b): la API no confía solo en el rol del
// token. En cada petición comprueba que la cuenta exista, esté activa y tenga ese rol; si no, 401 y la
// consola vuelve al ingreso. Sin PostgreSQL: el repositorio en memoria del escenario de HU-04.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { RolCuentaInterna } from '../comun/roles.js';
import { crearAdministracionServicio } from '../modulos/administracion/index.js';
import { errorConFormato, tokenAdmin } from './ayudantes.js';
import { crearEscenario, RUTA } from './escenario-usuarios-internos.js';

const MIS_REVISIONES = '/api/v1/admin/revision/mis-revisiones';

/** Escenario con la comprobación real: la cuenta 7 es administradora y la 8, docente; ambas activas. */
function conCuentas() {
  const escenario = crearEscenario({ comprobarCuentas: true });
  const cuenta = (id: string, rol: RolCuentaInterna) => ({
    id,
    nombre: `Cuenta ${id}`,
    correo: `cuenta${id}@ejemplo.cl`,
    rol,
    activo: true,
    areas: rol === 'docente' ? [1] : [],
    creadoEn: new Date('2026-10-23T12:00:00Z'),
    ultimoAcceso: null,
    hash: 'hash',
  });
  escenario.usuarios.set('7', cuenta('7', 'admin'));
  escenario.usuarios.set('8', cuenta('8', 'docente'));
  return escenario;
}

const con = async (rol: RolCuentaInterna, id: string) => ({
  Authorization: `Bearer ${await tokenAdmin(rol, id)}`,
});

describe('separación de roles en la consola (HU-03 esc. 3)', () => {
  it('con la cuenta vigente y su rol, cada uno entra solo a lo suyo', async () => {
    const { app } = conCuentas();

    expect(
      (
        await request(app)
          .get(RUTA)
          .set(await con('admin', '7'))
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .get(RUTA)
          .set(await con('docente', '8'))
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .get(MIS_REVISIONES)
          .set(await con('admin', '7'))
      ).status,
    ).toBe(403);
  });

  it('un token con un rol que la cuenta no tiene recibe 401, no el acceso de ese rol', async () => {
    const { app } = conCuentas();

    const respuesta = await request(app)
      .get(RUTA)
      .set(await con('admin', '8'));

    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual(errorConFormato('NO_AUTENTICADO'));
    expect(respuesta.body.error.mensaje).toMatch(/Vuelve a iniciar sesión/);
  });

  it('un token de una cuenta que no existe recibe 401', async () => {
    const { app } = conCuentas();

    expect(
      (
        await request(app)
          .get(RUTA)
          .set(await con('admin', '99'))
      ).status,
    ).toBe(401);
  });

  it('al pasar a un docente a administrador, su token de docente deja de servir de inmediato', async () => {
    const { app } = conCuentas();
    const tokenDocente = await con('docente', '8');

    const cambio = await request(app)
      .patch(`${RUTA}/8`)
      .set(await con('admin', '7'))
      .send({ rol: 'admin', areas: [] });
    expect(cambio.status).toBe(200);

    // Con el token anterior ya no entra a lo del docente ni a lo del administrador: debe ingresar de nuevo.
    expect((await request(app).get(MIS_REVISIONES).set(tokenDocente)).status).toBe(401);
    expect((await request(app).get(RUTA).set(tokenDocente)).status).toBe(401);
    expect(
      (
        await request(app)
          .get(RUTA)
          .set(await con('admin', '8'))
      ).status,
    ).toBe(200);
  });

  it('al desactivar una cuenta (CU-23 3.b), su token deja de servir en la siguiente petición', async () => {
    const { app } = conCuentas();
    const tokenDocente = await con('docente', '8');
    expect((await request(app).get(MIS_REVISIONES).set(tokenDocente)).status).not.toBe(401);

    const baja = await request(app)
      .post(`${RUTA}/8/desactivar`)
      .set(await con('admin', '7'));
    expect(baja.status).toBe(200);

    expect((await request(app).get(MIS_REVISIONES).set(tokenDocente)).status).toBe(401);
  });

  it('un administrador desactivado tampoco puede seguir gestionando cuentas', async () => {
    const { app, usuarios } = conCuentas();
    const cuenta = usuarios.get('7');
    if (cuenta) cuenta.activo = false;

    expect(
      (
        await request(app)
          .get(RUTA)
          .set(await con('admin', '7'))
      ).status,
    ).toBe(401);
  });
});

describe('cuentaInternaVigente', () => {
  it('un id que no es un número no consulta la base y no es vigente', async () => {
    let consultas = 0;
    const { usuarios } = conCuentas();
    const escenario = crearEscenario();
    const servicio = crearAdministracionServicio({
      bd: { query: () => Promise.reject(new Error('sin base')) },
      unidadDeTrabajo: { enTransaccion: () => Promise.reject(new Error('sin base')) },
      repositorio: {
        ...escenario.repositorio,
        buscarRolActivo: (id) => {
          consultas += 1;
          const usuario = usuarios.get(id);
          return Promise.resolve(usuario ? { rol: usuario.rol, activo: usuario.activo } : null);
        },
      },
    });

    expect(await servicio.cuentaInternaVigente('desarrollo', 'admin')).toBe(false);
    expect(await servicio.cuentaInternaVigente('7 OR 1=1', 'admin')).toBe(false);
    expect(consultas).toBe(0);
    expect(await servicio.cuentaInternaVigente('7', 'admin')).toBe(true);
    expect(await servicio.cuentaInternaVigente('7', 'docente')).toBe(false);
    expect(consultas).toBe(2);
  });
});
