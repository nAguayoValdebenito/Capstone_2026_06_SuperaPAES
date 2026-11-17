// Continuidad del administrador (CU-23 3.c, HU-04 escenario 6): no se desactiva la propia cuenta ni al
// último administrador activo, y no se quita ese rol. Sin PostgreSQL; la prueba con dos cambios
// simultáneos está en usuarios-internos-bd.test.ts.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorConFormato, tokenAdmin } from './ayudantes.js';
import { comoAdmin, crearEscenario, RUTA } from './escenario-usuarios-internos.js';

describe('continuidad del administrador (CU-23 3.c, HU-04 escenario 6)', () => {
  const administrador = (correo: string) => ({
    nombre: 'Otra Admin',
    correo,
    rol: 'admin',
    contrasena: 'clave-inicial-9',
  });
  const como = async (id: string) => ({ Authorization: `Bearer ${await tokenAdmin('admin', id)}` });

  /** Cuentas 1 y 2: administradores activos creados desde C10 por el administrador 7. */
  async function conAdministradores(cantidad: 1 | 2) {
    const escenario = crearEscenario();
    for (let i = 1; i <= cantidad; i++) {
      await request(escenario.app)
        .post(RUTA)
        .set(await comoAdmin())
        .send(administrador(`admin${i}@ejemplo.cl`));
    }
    escenario.auditoria.length = 0;
    return escenario;
  }

  it('no se desactiva la propia cuenta: 409, sin cambio y sin auditoría', async () => {
    const { app, usuarios, auditoria } = await conAdministradores(2);

    const respuesta = await request(app)
      .post(`${RUTA}/1/desactivar`)
      .set(await como('1'));

    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual(errorConFormato('CONFLICTO'));
    expect(respuesta.body.error.mensaje).toMatch(/propia cuenta/);
    expect(usuarios.get('1')?.activo).toBe(true);
    expect(auditoria).toHaveLength(0);
  });

  it('no se desactiva al último administrador activo: 409', async () => {
    const { app, usuarios, auditoria } = await conAdministradores(1);

    const respuesta = await request(app)
      .post(`${RUTA}/1/desactivar`)
      .set(await comoAdmin());

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.mensaje).toMatch(/último administrador activo/);
    expect(usuarios.get('1')?.activo).toBe(true);
    expect(auditoria).toHaveLength(0);
  });

  it('con dos administradores activos, desactivar al otro funciona y deja su auditoría', async () => {
    const { app, auditoria } = await conAdministradores(2);

    const respuesta = await request(app)
      .post(`${RUTA}/2/desactivar`)
      .set(await como('1'));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.activo).toBe(false);
    expect(auditoria).toEqual([
      expect.objectContaining({ usuarioId: '1', accion: 'desactivar_usuario', entidadId: '2' }),
    ]);
  });

  it('no se quita el rol de administrador al último administrador activo: 409', async () => {
    const { app, usuarios, auditoria } = await conAdministradores(1);

    const respuesta = await request(app)
      .patch(`${RUTA}/1`)
      .set(await comoAdmin())
      .send({ rol: 'docente', areas: [1] });

    expect(respuesta.status).toBe(409);
    expect(usuarios.get('1')?.rol).toBe('admin');
    expect(auditoria).toHaveLength(0);
  });

  it('un administrador no se quita su propio rol, aunque haya otros', async () => {
    const { app, auditoria } = await conAdministradores(2);

    const respuesta = await request(app)
      .patch(`${RUTA}/1`)
      .set(await como('1'))
      .send({ rol: 'docente', areas: [1] });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.mensaje).toMatch(/rol de administrador/);
    expect(auditoria).toHaveLength(0);
  });

  it('activar al último administrador o editar su nombre sigue permitido', async () => {
    const { app } = await conAdministradores(1);

    const respuesta = await request(app)
      .patch(`${RUTA}/1`)
      .set(await comoAdmin())
      .send({ nombre: 'Admin renombrada' });

    expect(respuesta.status).toBe(200);
  });
});
