// Gestión de usuarios internos (HU-04, RF-C02, CU-23): validación, contraseña inicial (RN-31) y
// auditoría de cada creación, edición, activación y desactivación (RNF-08), sin base real.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp, crearServicios } from '../app.js';
import { compararContrasena } from '../comun/contrasenas.js';
import type { Ejecutor, UnidadDeTrabajo } from '../db/transaccion.js';
import type {
  AdministracionRepositorio,
  EntradaAuditoria,
  UsuarioInterno,
} from '../modulos/administracion/administracion.repositorio.js';
import { crearAdministracionServicio } from '../modulos/administracion/index.js';
import { crearDependenciasDePrueba, errorConFormato, tokenAdmin } from './ayudantes.js';

const RUTA = '/api/v1/admin/administracion/usuarios-internos';
const AREAS_EXISTENTES = new Set([1, 2, 3]);

/** Repositorio en memoria con las restricciones de la base que el servicio traduce. */
function crearRepositorioFalso() {
  const usuarios = new Map<string, UsuarioInterno & { hash: string }>();
  const auditoria: EntradaAuditoria[] = [];
  let siguienteId = 1;
  const sinHash = ({ hash: _hash, ...usuario }: UsuarioInterno & { hash: string }) => ({
    ...usuario,
  });
  const repositorio: AdministracionRepositorio = {
    listarUsuariosInternos: () => Promise.resolve([...usuarios.values()].map(sinHash)),
    buscarUsuarioInterno: (id) => {
      const usuario = usuarios.get(id);
      return Promise.resolve(usuario ? sinHash(usuario) : null);
    },
    crearUsuarioInterno: ({ nombre, correo, rol, hashContrasena }) => {
      if ([...usuarios.values()].some((u) => u.correo === correo)) {
        return Promise.reject(
          Object.assign(new Error('duplicado'), {
            code: '23505',
            constraint: 'ux_usuario_interno_correo',
          }),
        );
      }
      const id = String(siguienteId++);
      const creadoEn = new Date('2026-10-23T12:00:00Z');
      const nuevo = { id, nombre, correo, rol, activo: true, areas: [], creadoEn };
      usuarios.set(id, { ...nuevo, ultimoAcceso: null, hash: hashContrasena });
      return Promise.resolve(id);
    },
    actualizarUsuarioInterno: (id, { nombre, rol, hashContrasena }) => {
      const usuario = usuarios.get(id);
      if (usuario) Object.assign(usuario, { nombre, rol, hash: hashContrasena ?? usuario.hash });
      return Promise.resolve();
    },
    cambiarActivoUsuarioInterno: (id, activo) => {
      const usuario = usuarios.get(id);
      if (usuario) usuario.activo = activo;
      return Promise.resolve();
    },
    reemplazarEspecialidades: (id, areas) => {
      if (areas.some((area) => !AREAS_EXISTENTES.has(area))) {
        return Promise.reject(
          Object.assign(new Error('fk'), { code: '23503', table: 'docente_especialidad' }),
        );
      }
      const usuario = usuarios.get(id);
      if (usuario) usuario.areas = [...areas];
      return Promise.resolve();
    },
    registrarAuditoria: (entrada) => {
      auditoria.push(entrada);
      return Promise.resolve();
    },
    hayAdministrador: () =>
      Promise.resolve([...usuarios.values()].some((usuario) => usuario.rol === 'admin')),
  };
  return { repositorio, usuarios, auditoria };
}

function crearEscenario() {
  const falso = crearRepositorioFalso();
  const tx: Ejecutor = { query: () => Promise.reject(new Error('sin base')) };
  let transacciones = 0;
  const unidadDeTrabajo: UnidadDeTrabajo = {
    enTransaccion: (trabajo) => {
      transacciones += 1;
      return trabajo(tx);
    },
  };
  const dependencias = crearDependenciasDePrueba({ unidadDeTrabajo });
  const administracion = crearAdministracionServicio({
    bd: dependencias.bd,
    unidadDeTrabajo,
    repositorio: falso.repositorio,
  });
  const app = crearApp(dependencias, { ...crearServicios(dependencias), administracion });
  return { ...falso, app, administracion, transacciones: () => transacciones };
}

const docente = (cambios: Record<string, unknown> = {}) => ({
  nombre: 'Diego Docente',
  correo: 'Diego@Ejemplo.cl',
  rol: 'docente',
  areas: [2, 1, 2],
  contrasena: 'clave-inicial-9',
  ...cambios,
});

async function comoAdmin() {
  return { Authorization: `Bearer ${await tokenAdmin('admin', '7')}` };
}

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
    ['de 7 caracteres', { contrasena: 'corta12' }],
    ['igual al correo', { contrasena: 'diego@ejemplo.cl' }],
    ['de más de 72 bytes', { contrasena: 'ñ'.repeat(40) }],
  ])('rechaza una contraseña %s (RN-31)', async (_caso, cambios) => {
    const { app, auditoria } = crearEscenario();

    const respuesta = await request(app)
      .post(RUTA)
      .set(await comoAdmin())
      .send(docente(cambios));

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
    expect(respuesta.body.error.detalles[0].ruta).toBe('contrasena');
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
    const { app, auditoria } = await conDocenteCreado();
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
  });

  it('responde 404 si la cuenta no existe y 400 si el id no es válido', async () => {
    const { app } = await conDocenteCreado();
    const admin = await comoAdmin();

    expect((await request(app).post(`${RUTA}/99/activar`).set(admin)).status).toBe(404);
    expect((await request(app).post(`${RUTA}/abc/activar`).set(admin)).status).toBe(400);
    expect((await request(app).patch(`${RUTA}/1`).set(admin).send({})).status).toBe(400);
  });
});

describe('primer administrador (npm run crear-admin)', () => {
  const datos = { nombre: 'Nicolás', correo: 'Admin@Ejemplo.cl', contrasena: 'clave-del-admin' };

  it('crea la cuenta de administrador y audita la creación con la misma cuenta como autor', async () => {
    const { administracion, usuarios, auditoria, transacciones } = crearEscenario();

    const creado = await administracion.crearPrimerAdministrador(datos);

    expect(creado).toMatchObject({
      correo: 'admin@ejemplo.cl',
      rol: 'admin',
      activo: true,
      areas: [],
    });
    expect(await compararContrasena('clave-del-admin', usuarios.get(creado.id)?.hash ?? '')).toBe(
      true,
    );
    expect(auditoria).toEqual([
      expect.objectContaining({
        usuarioId: creado.id,
        accion: 'crear_usuario',
        entidadId: creado.id,
      }),
    ]);
    expect(JSON.stringify(auditoria)).not.toMatch(/clave-del-admin|\$2/);
    expect(transacciones()).toBe(1);
  });

  it('se niega si ya existe un administrador', async () => {
    const { administracion, auditoria } = crearEscenario();
    await administracion.crearPrimerAdministrador(datos);

    await expect(
      administracion.crearPrimerAdministrador({ ...datos, correo: 'otro@ejemplo.cl' }),
    ).rejects.toMatchObject({ codigo: 'CONFLICTO' });
    expect(auditoria).toHaveLength(1);
  });

  it.each([
    ['una contraseña corta', { contrasena: 'corta' }],
    ['una contraseña igual al correo', { contrasena: 'admin@ejemplo.cl' }],
    ['un correo inválido', { correo: 'no-es-correo' }],
    ['sin nombre', { nombre: '  ' }],
  ])('rechaza %s (RN-31) sin crear nada', async (_caso, cambios) => {
    const { administracion, usuarios } = crearEscenario();

    await expect(
      administracion.crearPrimerAdministrador({ ...datos, ...cambios }),
    ).rejects.toMatchObject({ codigo: 'VALIDACION' });
    expect(usuarios.size).toBe(0);
  });
});
