// Gestión de usuarios internos (HU-04, RF-C02, CU-23): validación, contraseña inicial (RN-31) y
// auditoría de cada creación, edición, activación y desactivación (RNF-08), sin base real.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { compararContrasena } from '../comun/contrasenas.js';
import { errorConFormato, tokenAdmin } from './ayudantes.js';
import { comoAdmin, crearEscenario, docente, RUTA } from './escenario-usuarios-internos.js';

describe('crear un usuario interno', () => {
  it('guarda la cuenta con bcrypt y audita la creación sin la contraseña', async () => {
    const { app, usuarios, auditoria, transacciones } = crearEscenario();

    const respuesta = await request(app)
      .post(RUTA)
      .set(await comoAdmin())
      .send(docente());

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toMatchObject({
      correo: 'diego@ejemplo.cl',
      rol: 'docente',
      activo: true,
      areas: [1, 2],
    });
    expect(JSON.stringify(respuesta.body)).not.toMatch(/hash|contrasena|clave-inicial/);
    const guardado = usuarios.get('1');
    expect(await compararContrasena('clave-inicial-9', guardado?.hash ?? '')).toBe(true);
    expect(auditoria).toEqual([
      {
        usuarioId: '7',
        accion: 'crear_usuario',
        entidad: 'usuario_interno',
        entidadId: '1',
        antes: null,
        despues: {
          nombre: 'Diego Docente',
          correo: 'diego@ejemplo.cl',
          rol: 'docente',
          activo: true,
          areas: [1, 2],
        },
      },
    ]);
    expect(transacciones()).toBe(1);
  });

  it.each([
    ['de 7 caracteres', { contrasena: 'corta12' }, 'contrasena_corta'],
    ['igual al correo', { contrasena: 'diego@ejemplo.cl' }, 'contrasena_igual_correo'],
    ['de más de 72 bytes', { contrasena: 'ñ'.repeat(40) }, 'contrasena_bytes'],
    ['común (HU-01.4)', { contrasena: 'Contraseña123' }, 'contrasena_comun'],
  ])('rechaza una contraseña %s (RN-31)', async (_caso, cambios, motivo) => {
    const { app, auditoria } = crearEscenario();

    const respuesta = await request(app)
      .post(RUTA)
      .set(await comoAdmin())
      .send(docente(cambios));

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
    expect(respuesta.body.error.detalles[0]).toMatchObject({ ruta: 'contrasena', motivo });
    expect(auditoria).toHaveLength(0);
  });

  it('responde 409 con el formato común si el correo ya tiene cuenta', async () => {
    const { app } = crearEscenario();
    await request(app)
      .post(RUTA)
      .set(await comoAdmin())
      .send(docente());

    const respuesta = await request(app)
      .post(RUTA)
      .set(await comoAdmin())
      .send(docente({ correo: 'DIEGO@ejemplo.cl' }));

    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual(errorConFormato('CONFLICTO'));
  });

  it.each([
    ['un docente sin áreas', docente({ areas: [] })],
    ['un administrador con áreas', docente({ rol: 'admin', areas: [1] })],
    ['un área que no existe', docente({ areas: [99] })],
  ])('rechaza %s', async (_caso, cuerpo) => {
    const { app, auditoria } = crearEscenario();

    const respuesta = await request(app)
      .post(RUTA)
      .set(await comoAdmin())
      .send(cuerpo);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles[0].ruta).toBe('areas');
    expect(auditoria).toHaveLength(0);
  });

  it('un docente recibe 403 al crear o listar usuarios internos', async () => {
    const { app } = crearEscenario();
    const comoDocente = { Authorization: `Bearer ${await tokenAdmin('docente', '8')}` };

    expect((await request(app).get(RUTA).set(comoDocente)).status).toBe(403);
    expect((await request(app).post(RUTA).set(comoDocente).send(docente())).status).toBe(403);
  });
});

describe('editar, activar y desactivar un usuario interno', () => {
  async function conDocenteCreado() {
    const escenario = crearEscenario();
    await request(escenario.app)
      .post(RUTA)
      .set(await comoAdmin())
      .send(docente());
    escenario.auditoria.length = 0;
    return escenario;
  }

  it('la contraseña nueva queda solo como contrasena_cambiada en la auditoría', async () => {
    const { app, usuarios, auditoria } = await conDocenteCreado();

    const respuesta = await request(app)
      .patch(`${RUTA}/1`)
      .set(await comoAdmin())
      .send({ nombre: 'Diego D.', contrasena: 'clave-nueva-10' });

    expect(respuesta.status).toBe(200);
    expect(await compararContrasena('clave-nueva-10', usuarios.get('1')?.hash ?? '')).toBe(true);
    expect(auditoria[0]).toMatchObject({
      accion: 'editar_usuario',
      antes: { nombre: 'Diego Docente', areas: [1, 2] },
      despues: { nombre: 'Diego D.', areas: [1, 2], contrasena_cambiada: true },
    });
    expect(JSON.stringify(auditoria)).not.toMatch(/clave-nueva|\$2/);
  });

  it('rechaza una contraseña nueva igual al correo de la cuenta', async () => {
    const { app, auditoria } = await conDocenteCreado();

    const respuesta = await request(app)
      .patch(`${RUTA}/1`)
      .set(await comoAdmin())
      .send({ contrasena: 'DIEGO@EJEMPLO.CL' });

    expect(respuesta.status).toBe(400);
    expect(auditoria).toHaveLength(0);
  });

  it('al pasar a administrador se quitan las áreas', async () => {
    const { app } = await conDocenteCreado();

    const respuesta = await request(app)
      .patch(`${RUTA}/1`)
      .set(await comoAdmin())
      .send({ rol: 'admin' });

    expect(respuesta.body.data).toMatchObject({ rol: 'admin', areas: [] });
  });

  it('desactiva y activa la cuenta, con una fila de auditoría por cambio', async () => {
    const { app, auditoria, sesionesRevocadas, tx } = await conDocenteCreado();
    const admin = await comoAdmin();

    const desactivada = await request(app).post(`${RUTA}/1/desactivar`).set(admin);
    await request(app).post(`${RUTA}/1/desactivar`).set(admin); // ya estaba desactivada
    const activada = await request(app).post(`${RUTA}/1/activar`).set(admin);

    expect(desactivada.body.data.activo).toBe(false);
    expect(activada.body.data.activo).toBe(true);
    expect(auditoria.map((a) => [a.accion, a.antes?.activo, a.despues?.activo])).toEqual([
      ['desactivar_usuario', true, false],
      ['activar_usuario', false, true],
    ]);
    // CU-23 3.b: solo la desactivación cierra sus sesiones, en la misma transacción que el cambio.
    expect(sesionesRevocadas).toEqual([{ id: '1', tx }]);
  });

  it('responde 404 si la cuenta no existe y 400 si el id no es válido', async () => {
    const { app } = await conDocenteCreado();
    const admin = await comoAdmin();

    expect((await request(app).post(`${RUTA}/99/activar`).set(admin)).status).toBe(404);
    expect((await request(app).post(`${RUTA}/abc/activar`).set(admin)).status).toBe(400);
    expect((await request(app).patch(`${RUTA}/1`).set(admin).send({})).status).toBe(400);
  });
});
