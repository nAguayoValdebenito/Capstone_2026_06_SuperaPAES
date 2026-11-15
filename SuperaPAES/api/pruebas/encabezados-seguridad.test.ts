// Encabezados de seguridad de la API: sin X-Powered-By, la consola y la app sin caché y los errores
// internos sin detalles para el cliente.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearServicios } from '../app.js';
import { crearAppDePrueba, crearDependenciasDePrueba, tokenAdmin, tokenApp } from './ayudantes.js';

const app = crearAppDePrueba();

describe('encabezados de seguridad de la API', () => {
  it.each(['/api/v1/salud/vivo', '/api/v1/admin/cuentas/yo', '/api/v1/no-existe'])(
    '%s no dice con qué está hecha la API',
    async (ruta) => {
      const respuesta = await request(app).get(ruta);

      expect(respuesta.headers['x-powered-by']).toBeUndefined();
    },
  );

  it('las respuestas de la consola no se guardan en caché, también las de error', async () => {
    const sinToken = await request(app).get('/api/v1/admin/cuentas/yo');
    const ingresoInvalido = await request(app).post('/api/v1/admin/cuentas/ingreso').send({});

    expect(sinToken.status).toBe(401);
    expect(sinToken.headers['cache-control']).toBe('no-store');
    expect(ingresoInvalido.status).toBe(400);
    expect(ingresoInvalido.headers['cache-control']).toBe('no-store');
  });

  it('las respuestas de la app no se guardan en caché: públicas, con sesión y de error', async () => {
    const ingresoInvalido = await request(app).post('/api/v1/app/cuentas/ingreso').send({});
    const sinToken = await request(app).get('/api/v1/app/privacidad/solicitudes');
    const conSesion = await request(app)
      .get('/api/v1/app/no-existe')
      .set({ Authorization: `Bearer ${await tokenApp()}` });

    expect(ingresoInvalido.status).toBe(400);
    expect(ingresoInvalido.headers['cache-control']).toBe('no-store');
    expect(sinToken.status).toBe(401);
    expect(sinToken.headers['cache-control']).toBe('no-store');
    expect(conSesion.status).toBe(404);
    expect(conSesion.headers['cache-control']).toBe('no-store');
  });

  it('la salud y las rutas fuera de /app y /admin no cambian su caché', async () => {
    const salud = await request(app).get('/api/v1/salud/vivo');

    expect(salud.headers['cache-control']).not.toBe('no-store');
  });

  it('un error inesperado responde 500 con un mensaje genérico, sin su detalle interno', async () => {
    const dependencias = crearDependenciasDePrueba();
    const servicios = crearServicios(dependencias);
    const conFalla = crearAppDePrueba(
      {},
      {
        temario: {
          ...servicios.temario,
          listarAreas: () => Promise.reject(new Error('relation "contenido.area" en 10.0.0.5')),
        },
      },
    );

    const respuesta = await request(conFalla)
      .get('/api/v1/admin/temario/areas')
      .set({ Authorization: `Bearer ${await tokenAdmin()}` });

    expect(respuesta.status).toBe(500);
    expect(respuesta.body).toEqual({
      data: null,
      error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado.' },
      meta: null,
    });
    expect(respuesta.text).not.toMatch(/contenido\.area|10\.0\.0\.5|at /);
  });
});
