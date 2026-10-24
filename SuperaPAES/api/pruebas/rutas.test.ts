// Montaje de rutas por módulo, validación de la entrada, límite de intentos y webhooks de las tiendas.
// La separación de tokens y los permisos por rol están en permisos.test.ts; la sesión de la consola,
// en sesion-consola.test.ts.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearServicios } from '../app.js';
import { ErrorNoAutenticado } from '../comun/errores.js';
import { crearTemarioServicio } from '../modulos/temario/index.js';
import {
  crearAppDePrueba,
  crearDependenciasDePrueba,
  cuerpoIngreso,
  cuerpoRegistro,
  tokenAdmin,
  tokenApp,
} from './ayudantes.js';

const app = crearAppDePrueba();
const RUTA_REGISTRO = '/api/v1/app/cuentas/registro';
const RUTA_INGRESO_APP = '/api/v1/app/cuentas/ingreso';
const RUTA_INGRESO_ADMIN = '/api/v1/admin/cuentas/ingreso';
const RUTA_INVITACIONES = '/api/v1/app/cupo-invitaciones/invitaciones';
const conToken = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('áreas de especialidad del temario', () => {
  it('el administrador recibe id y nombre de cada área', async () => {
    const areas = [
      { id: 4, nombre: 'Biología' },
      { id: 1, nombre: 'Lenguaje' },
    ];
    const temario = crearTemarioServicio({
      ...crearDependenciasDePrueba(),
      repositorio: { listarAreas: () => Promise.resolve(areas) },
    });
    const conAreas = crearAppDePrueba({}, { temario });

    const respuesta = await request(conAreas)
      .get('/api/v1/admin/temario/areas')
      .set(conToken(await tokenAdmin()));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ data: areas, error: null, meta: null });
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

  it.each([
    'temario',
    'preguntas',
    'evaluaciones',
    'cupo-invitaciones',
    'suscripciones',
    'privacidad',
  ])('/api/v1/app/%s está detrás de la autenticación de la app', async (modulo) => {
    expect((await request(app).get(`/api/v1/app/${modulo}`)).status).toBe(401);
  });

  it.each([
    [RUTA_REGISTRO, cuerpoRegistro()],
    [RUTA_INGRESO_APP, cuerpoIngreso()],
    ['/api/v1/app/cuentas/recuperar-contrasena', { correo: cuerpoIngreso().correo }],
  ])('%s es pública y todavía responde 501', async (ruta, cuerpo) => {
    const respuesta = await request(crearAppDePrueba()).post(ruta).send(cuerpo);

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

  it('el registro rechaza una contraseña igual al correo (RN-31, componente común)', async () => {
    const respuesta = await request(app)
      .post(RUTA_REGISTRO)
      .send(cuerpoRegistro({ contrasena: 'ANA@ejemplo.cl' }));

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles[0].ruta).toBe('contrasena');
  });

  it('el registro exige declarar 14 años o más (RN-18)', async () => {
    const respuesta = await request(app)
      .post(RUTA_REGISTRO)
      .send(cuerpoRegistro({ declaraTenerCatorceAnios: false }));

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });

  it('el registro exige aceptar la política de privacidad, que es obligatoria', async () => {
    const respuesta = await request(app)
      .post(RUTA_REGISTRO)
      .send(cuerpoRegistro({ aceptaPrivacidad: undefined }));

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });

  it.each(['ABC23', 'ABC2345', 'ABCDE0', 'ABCDEO', 'ABCDE1', 'ABCDEI', 'ABC-23'])(
    'rechaza el código de invitación %s (RN-33)',
    async (codigo) => {
      const respuesta = await request(app)
        .post(RUTA_REGISTRO)
        .send(cuerpoRegistro({ codigoInvitacion: codigo }));

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.codigo).toBe('VALIDACION');
    },
  );

  it('acepta el código de invitación en minúsculas y con espacios', async () => {
    const respuesta = await request(app)
      .post(RUTA_INVITACIONES)
      .set(conToken(await tokenApp()))
      .send({ codigo: ' abc234 ' });

    expect(respuesta.status).toBe(501);
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
  const limite = { limiteIntentos: { ventanaMs: 60_000, maximo: 2 } };
  const appLimitada = () => crearAppDePrueba(limite);
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
    const dependencias = crearDependenciasDePrueba(limite);
    const { cuentas } = crearServicios(dependencias);
    const limitada = crearAppDePrueba(limite, {
      cuentas: {
        ...cuentas,
        ingresarUsuarioInterno: () => Promise.reject(new ErrorNoAutenticado()),
      },
    });
    for (let i = 0; i < 3; i++) {
      await request(limitada).post(RUTA_INGRESO_APP).send(ingreso);
    }

    const respuesta = await request(limitada).post(RUTA_INGRESO_ADMIN).send(ingreso);

    expect(respuesta.status).toBe(401);
  });

  it('las invitaciones también están limitadas, después de autenticar y validar', async () => {
    const limitada = appLimitada();
    const token = conToken(await tokenApp());
    for (let i = 0; i < 2; i++) {
      await request(limitada).post(RUTA_INVITACIONES).set(token).send({ codigo: 'ABC234' });
    }

    const respuesta = await request(limitada)
      .post(RUTA_INVITACIONES)
      .set(token)
      .send({ codigo: 'ABC234' });

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
