// Montaje de rutas por módulo, separación de tokens de la app y de la consola, autorización por rol,
// límite de intentos y webhooks de las tiendas.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../app.js';
import { firmarToken } from '../comun/jwt.js';
import {
  crearDependenciasDePrueba,
  cuerpoIngreso,
  cuerpoRegistro,
  errorConFormato,
  SECRETO_APP_DE_PRUEBA,
  tokenAdmin,
  tokenApp,
} from './ayudantes.js';

const app = crearApp(crearDependenciasDePrueba());
const RUTA_REGISTRO = '/api/v1/app/cuentas/registro';
const RUTA_INGRESO_APP = '/api/v1/app/cuentas/ingreso';
const RUTA_INGRESO_ADMIN = '/api/v1/admin/cuentas/ingreso';
const RUTA_INVITACIONES = '/api/v1/app/cupo-invitaciones/invitaciones';
const conToken = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('separación de tokens de la app y de la consola', () => {
  it('un token de la app recibe 401 en /api/v1/admin', async () => {
    const respuesta = await request(app)
      .get('/api/v1/admin/temario')
      .set(conToken(await tokenApp()));

    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual(errorConFormato('NO_AUTENTICADO'));
  });

  it('un token de la consola recibe 401 en /api/v1/app', async () => {
    const respuesta = await request(app)
      .get('/api/v1/app/practica')
      .set(conToken(await tokenAdmin()));

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe('NO_AUTENTICADO');
  });

  it('un token firmado con el secreto de la app pero con audiencia admin no sirve en la consola', async () => {
    const falsificado = await firmarToken(
      'admin',
      { sub: '1', rol: 'admin' },
      SECRETO_APP_DE_PRUEBA,
    );

    const respuesta = await request(app).get('/api/v1/admin/temario').set(conToken(falsificado));

    expect(respuesta.status).toBe(401);
  });

  it('sin token, ambas interfaces responden 401', async () => {
    expect((await request(app).get('/api/v1/admin/temario')).status).toBe(401);
    expect((await request(app).get('/api/v1/app/practica')).status).toBe(401);
  });

  it('un token vencido responde 401', async () => {
    const vencido = await firmarToken('app', { sub: '10' }, SECRETO_APP_DE_PRUEBA, '-1s');

    const respuesta = await request(app).get('/api/v1/app/practica').set(conToken(vencido));

    expect(respuesta.status).toBe(401);
  });

  it('con el token correcto pasa la autenticación y llega al módulo (sin endpoints aún: 404)', async () => {
    const admin = await request(app)
      .get('/api/v1/admin/temario')
      .set(conToken(await tokenAdmin()));
    const estudiante = await request(app)
      .get('/api/v1/app/practica')
      .set(conToken(await tokenApp()));

    expect(admin.status).toBe(404);
    expect(estudiante.status).toBe(404);
  });
});

describe('autorización por rol en la consola', () => {
  it('un docente recibe 403 en un módulo solo para el administrador', async () => {
    const respuesta = await request(app)
      .get('/api/v1/admin/administracion')
      .set(conToken(await tokenAdmin('docente')));

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.codigo).toBe('SIN_PERMISO');
  });

  it('un docente puede entrar a revisión', async () => {
    const respuesta = await request(app)
      .get('/api/v1/admin/revision')
      .set(conToken(await tokenAdmin('docente')));

    expect(respuesta.status).toBe(404);
  });
});

describe('módulos montados', () => {
  it.each([
    'temario',
    'preguntas',
    'generador',
    'revision',
    'suscripciones',
    'privacidad',
    'administracion',
  ])('/api/v1/admin/%s está detrás de la autenticación de la consola', async (modulo) => {
    expect((await request(app).get(`/api/v1/admin/${modulo}`)).status).toBe(401);
  });

  it.each(['temario', 'preguntas', 'practica', 'cupo-invitaciones', 'suscripciones', 'privacidad'])(
    '/api/v1/app/%s está detrás de la autenticación de la app',
    async (modulo) => {
      expect((await request(app).get(`/api/v1/app/${modulo}`)).status).toBe(401);
    },
  );

  it.each([
    [RUTA_REGISTRO, cuerpoRegistro()],
    [RUTA_INGRESO_APP, cuerpoIngreso()],
    ['/api/v1/app/cuentas/recuperar-contrasena', { correo: cuerpoIngreso().correo }],
    [RUTA_INGRESO_ADMIN, cuerpoIngreso({ correo: 'admin@ejemplo.cl' })],
  ])('%s es pública y todavía responde 501', async (ruta, cuerpo) => {
    const respuesta = await request(crearApp(crearDependenciasDePrueba())).post(ruta).send(cuerpo);

    expect(respuesta.status).toBe(501);
    expect(respuesta.body.error.codigo).toBe('NO_IMPLEMENTADO');
  });

  it('la contraseña se limita a 72 bytes de UTF-8, no a 72 caracteres', async () => {
    const respuesta = await request(app)
      .post(RUTA_REGISTRO)
      .send(cuerpoRegistro({ contrasena: 'ñ'.repeat(40) })); // 40 caracteres, 80 bytes

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });

  it('el registro exige declarar 14 años o más (RN-18)', async () => {
    const respuesta = await request(app)
      .post(RUTA_REGISTRO)
      .send(cuerpoRegistro({ declaraTenerCatorceAnios: false }));

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });
});

describe('webhooks de las tiendas', () => {
  it.each(['google-play', 'app-store'])(
    '/api/v1/webhooks/%s no exige JWT y responde 501 mientras no esté implementado',
    async (tienda) => {
      const respuesta = await request(app)
        .post(`/api/v1/webhooks/${tienda}`)
        .send({ idEvento: 'evt-1', tipo: 'PRUEBA' });

      expect(respuesta.status).toBe(501);
      expect(respuesta.body.error.codigo).toBe('NO_IMPLEMENTADO');
    },
  );
});

describe('límite de intentos', () => {
  const appLimitada = () =>
    crearApp(crearDependenciasDePrueba({ limiteIntentos: { ventanaMs: 60_000, maximo: 2 } }));
  const ingreso = cuerpoIngreso();

  it('responde 429 con el formato común al superar el máximo', async () => {
    const limitada = appLimitada();
    for (let i = 0; i < 2; i++) {
      await request(limitada).post(RUTA_INGRESO_APP).send(ingreso);
    }

    const respuesta = await request(limitada).post(RUTA_INGRESO_APP).send(ingreso);

    expect(respuesta.status).toBe(429);
    expect(respuesta.body.error.codigo).toBe('DEMASIADOS_INTENTOS');
  });

  it('cada ruta limitada lleva su propio contador', async () => {
    const limitada = appLimitada();
    for (let i = 0; i < 3; i++) {
      await request(limitada).post(RUTA_INGRESO_APP).send(ingreso);
    }

    const respuesta = await request(limitada).post(RUTA_INGRESO_ADMIN).send(ingreso);

    expect(respuesta.status).toBe(501);
  });

  it('las invitaciones también están limitadas, después de autenticar y validar', async () => {
    const limitada = appLimitada();
    const token = conToken(await tokenApp());
    for (let i = 0; i < 2; i++) {
      await request(limitada).post(RUTA_INVITACIONES).set(token).send({ codigo: 'ABC123' });
    }

    const respuesta = await request(limitada)
      .post(RUTA_INVITACIONES)
      .set(token)
      .send({ codigo: 'ABC123' });

    expect(respuesta.status).toBe(429);
  });

  it('usa la IP real que informa el proxy (trust proxy)', async () => {
    const limitada = appLimitada();
    const desde = (ip: string) =>
      request(limitada).post(RUTA_INGRESO_APP).set('X-Forwarded-For', ip).send(ingreso);
    for (let i = 0; i < 3; i++) await desde('203.0.113.1');

    expect((await desde('203.0.113.2')).status).toBe(501);
  });
});
