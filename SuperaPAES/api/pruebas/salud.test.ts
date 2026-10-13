import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../app.js';
import { comprobarBaseDeDatos } from '../db/conexion.js';
import { crearDependenciasDePrueba, errorConFormato } from './ayudantes.js';

const RUTA_INGRESO_APP = '/api/v1/app/cuentas/ingreso';
const RUTA_REGISTRO = '/api/v1/app/cuentas/registro';

describe('GET /api/v1/salud', () => {
  it('responde 200 con { data, error, meta } cuando la base de datos responde', async () => {
    const app = crearApp(crearDependenciasDePrueba());

    const respuesta = await request(app).get('/api/v1/salud');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      data: { estado: 'ok', baseDeDatos: 'ok' },
      error: null,
      meta: null,
    });
  });

  it('responde 503 con el formato común cuando la base no responde, sin detalles técnicos', async () => {
    const app = crearApp(
      crearDependenciasDePrueba({
        comprobarBaseDeDatos: () =>
          Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:5432')),
      }),
    );

    const respuesta = await request(app).get('/api/v1/salud');

    expect(respuesta.status).toBe(503);
    expect(respuesta.body).toEqual(errorConFormato('BASE_DE_DATOS_NO_DISPONIBLE'));
    expect(JSON.stringify(respuesta.body)).not.toContain('ECONNREFUSED');
  });

  it('responde 503 en menos de 4 segundos si la base no contesta', async () => {
    const baseColgada = { query: () => new Promise<never>(() => undefined) };
    const app = crearApp(
      crearDependenciasDePrueba({ comprobarBaseDeDatos: () => comprobarBaseDeDatos(baseColgada) }),
    );
    const inicio = Date.now();

    const respuesta = await request(app).get('/api/v1/salud');

    expect(respuesta.status).toBe(503);
    expect(Date.now() - inicio).toBeLessThan(4000);
  });
});

describe('GET /api/v1/salud/vivo', () => {
  it('responde 200 sin consultar la base de datos', async () => {
    let consultas = 0;
    const app = crearApp(
      crearDependenciasDePrueba({
        comprobarBaseDeDatos: () => {
          consultas++;
          return Promise.reject(new Error('base caída'));
        },
      }),
    );

    const respuesta = await request(app).get('/api/v1/salud/vivo');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ data: { estado: 'ok' }, error: null, meta: null });
    expect(consultas).toBe(0);
  });
});

describe('comprobarBaseDeDatos', () => {
  it('ejecuta SELECT 1 en la base', async () => {
    const consultas: string[] = [];
    const pool = {
      query: (sql: string) => {
        consultas.push(sql);
        return Promise.resolve({});
      },
    };

    await comprobarBaseDeDatos(pool, 100);

    expect(consultas).toEqual(['SELECT 1']);
  });

  it('falla al vencer el tiempo límite si la base no contesta', async () => {
    const pool = { query: () => new Promise<never>(() => undefined) };
    const inicio = Date.now();

    await expect(comprobarBaseDeDatos(pool, 50)).rejects.toThrow(/tiempo límite/);
    expect(Date.now() - inicio).toBeLessThan(1000);
  });
});

describe('formato común de errores', () => {
  it('una ruta inexistente responde 404 con { data, error, meta }', async () => {
    const app = crearApp(crearDependenciasDePrueba());

    const respuesta = await request(app).get('/api/v1/no-existe');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual(errorConFormato('NO_ENCONTRADO'));
  });

  it('un cuerpo JSON mal formado responde 400 con el formato común', async () => {
    const app = crearApp(crearDependenciasDePrueba());

    const respuesta = await request(app)
      .post(RUTA_INGRESO_APP)
      .set('Content-Type', 'application/json')
      .send('{"mal formado"');

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toEqual(errorConFormato('SOLICITUD_INVALIDA'));
  });

  it('un error del cliente al leer el cuerpo conserva su estado 4xx', async () => {
    const app = crearApp(crearDependenciasDePrueba());

    const respuesta = await request(app)
      .post(RUTA_INGRESO_APP)
      .set('Content-Type', 'application/json; charset=latin1')
      .send('{}');

    expect(respuesta.status).toBe(415);
    expect(respuesta.body.error.codigo).toBe('SOLICITUD_INVALIDA');
  });

  it('los datos inválidos responden 400 VALIDACION con el detalle de cada campo', async () => {
    const app = crearApp(crearDependenciasDePrueba());

    const respuesta = await request(app)
      .post(RUTA_REGISTRO)
      .send({ nombre: 'Ana', correo: 'no-es-correo', contrasena: 'corta' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.data).toBeNull();
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
    expect(respuesta.body.error.detalles).toEqual(
      expect.arrayContaining([expect.objectContaining({ ruta: 'correo' })]),
    );
  });
});

describe('CORS', () => {
  it('permite los orígenes configurados (la consola)', async () => {
    const app = crearApp(crearDependenciasDePrueba());

    const respuesta = await request(app)
      .get('/api/v1/salud')
      .set('Origin', 'http://localhost:5173');

    expect(respuesta.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('no autoriza orígenes que no están en la lista', async () => {
    const app = crearApp(crearDependenciasDePrueba());

    const respuesta = await request(app).get('/api/v1/salud').set('Origin', 'https://otro.example');

    expect(respuesta.headers['access-control-allow-origin']).toBeUndefined();
  });
});
