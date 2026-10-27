// Permisos por rol y separación de sesiones (HU-03.3, RNF-01, RNF-02, DAS 4.3.3):
// - CP-04 pasos 2 y 3: la sesión de la app no sirve en la consola ni al revés, y un estudiante no
//   puede entrar a la consola.
// - CP-05 pasos 2 y 3: cada rol recibe 403 SIN_PERMISO en las rutas del otro.
// El inventario de rutas (toda ruta declara su permiso) está en inventario-rutas-admin.test.ts.
import { SignJWT } from 'jose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  crearAppDePrueba,
  errorConFormato,
  SECRETO_APP_DE_PRUEBA,
  SECRETO_DE_PRUEBA,
  tokenAdmin,
  tokenApp,
} from './ayudantes.js';
import {
  ADMIN,
  conToken,
  crearEscenarioSesiones,
  DOCENTE,
  RUTA_APP_PROTEGIDA,
  RUTA_CERRAR_APP,
  RUTA_RENOVAR,
  RUTA_RENOVAR_APP,
  RUTA_YO,
} from './escenario-sesiones.js';

const ADMIN_API = '/api/v1/admin';

const ESTUDIANTE = { correo: 'eva@ejemplo.cl', contrasena: 'clave-de-eva-1' };

/** El estudiante ingresa por la app (HU-02.1) y entrega sus tokens. */
async function sesionDeEstudiante(escenario: ReturnType<typeof crearEscenarioSesiones>) {
  await escenario.crearEstudiante(ESTUDIANTE);
  const respuesta = await escenario.ingresarApp(ESTUDIANTE.correo, ESTUDIANTE.contrasena);
  expect(respuesta.status).toBe(200);
  return respuesta.body.data as { tokenAcceso: string; tokenRenovacion: string };
}

describe('separación de las sesiones de la app y de la consola (CP-04)', () => {
  it('paso 2: la sesión vigente de un estudiante recibe 401 en la consola y sí sirve en la app', async () => {
    const escenario = crearEscenarioSesiones();
    const { tokenAcceso } = await sesionDeEstudiante(escenario);

    const enConsola = await request(escenario.app).get(RUTA_YO).set(conToken(tokenAcceso));
    const enUsuarios = await request(escenario.app)
      .get(`${ADMIN_API}/administracion/usuarios-internos`)
      .set(conToken(tokenAcceso));
    // Pasa la autenticación de la app y llega al módulo, que aún no tiene rutas (404).
    const enApp = await request(escenario.app).get(RUTA_APP_PROTEGIDA).set(conToken(tokenAcceso));

    expect(enConsola.status).toBe(401);
    expect(enConsola.body).toEqual(errorConFormato('NO_AUTENTICADO'));
    expect(enUsuarios.status).toBe(401);
    expect(enApp.status).toBe(404);
  });

  it('paso 2: el token de renovación de un estudiante no renueva una sesión de la consola', async () => {
    const escenario = crearEscenarioSesiones();
    const { tokenRenovacion } = await sesionDeEstudiante(escenario);

    const respuesta = await request(escenario.app).post(RUTA_RENOVAR).send({ tokenRenovacion });

    expect(respuesta.status).toBe(401);
  });

  it('paso 2: el token de renovación de la consola no renueva en la app', async () => {
    const escenario = crearEscenarioSesiones();
    await escenario.crearCuenta(ADMIN);
    const { tokenRenovacion } = (await escenario.ingresar(ADMIN.correo, ADMIN.contrasena)).body
      .data as { tokenRenovacion: string };

    const respuesta = await request(escenario.app).post(RUTA_RENOVAR_APP).send({ tokenRenovacion });

    expect(respuesta.status).toBe(401);
  });

  it('paso 4: la sesión cerrada en la app ya no sirve, ni para renovar', async () => {
    const escenario = crearEscenarioSesiones();
    const { tokenAcceso, tokenRenovacion } = await sesionDeEstudiante(escenario);

    const cierre = await request(escenario.app).post(RUTA_CERRAR_APP).send({ tokenRenovacion });
    const acceso = await request(escenario.app).get(RUTA_APP_PROTEGIDA).set(conToken(tokenAcceso));
    const renovar = await request(escenario.app).post(RUTA_RENOVAR_APP).send({ tokenRenovacion });

    expect(cierre.status).toBe(200);
    expect(acceso.status).toBe(401);
    expect(acceso.body).toEqual(errorConFormato('NO_AUTENTICADO'));
    expect(renovar.status).toBe(401);
  });

  it('la sesión vigente de la consola recibe 401 en la app', async () => {
    const escenario = crearEscenarioSesiones();
    await escenario.crearCuenta(ADMIN);
    const ingreso = await escenario.ingresar(ADMIN.correo, ADMIN.contrasena);

    const respuesta = await request(escenario.app)
      .get(RUTA_APP_PROTEGIDA)
      .set(conToken(ingreso.body.data.tokenAcceso as string));

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe('NO_AUTENTICADO');
  });

  it('paso 3: un estudiante con cuenta no puede entrar a la consola con sus credenciales', async () => {
    const escenario = crearEscenarioSesiones();
    await escenario.crearEstudiante(ESTUDIANTE);

    const respuesta = await escenario.ingresar(ESTUDIANTE.correo, ESTUDIANTE.contrasena);

    expect(respuesta.status).toBe(401);
    expect(escenario.sesiones.size).toBe(0);
  });

  it('cada interfaz exige su propio secreto, audiencia y emisor', async () => {
    const app = crearAppDePrueba();
    const ahora = Math.floor(Date.now() / 1000);
    const firmar = (aud: string, iss: string, secreto: string) =>
      new SignJWT({ sid: '1', rol: 'admin' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('1')
        .setAudience(aud)
        .setIssuer(iss)
        .setIssuedAt(ahora)
        .setExpirationTime(ahora + 60)
        .sign(new TextEncoder().encode(secreto));
    const consola = (token: string) => request(app).get(RUTA_YO).set(conToken(token));

    const conSecretoDeLaApp = await consola(
      await firmar('admin', 'supera-paes-consola', SECRETO_APP_DE_PRUEBA),
    );
    const conAudienciaDeLaApp = await consola(
      await firmar('app', 'supera-paes-consola', SECRETO_DE_PRUEBA),
    );
    const conEmisorDeLaApp = await consola(
      await firmar('admin', 'supera-paes-app', SECRETO_DE_PRUEBA),
    );

    expect(conSecretoDeLaApp.status).toBe(401);
    expect(conAudienciaDeLaApp.status).toBe(401);
    expect(conEmisorDeLaApp.status).toBe(401);
  });

  it('un token sin el id de su sesión no sirve', async () => {
    const app = crearAppDePrueba();
    const ahora = Math.floor(Date.now() / 1000);
    const sinSesion = await new SignJWT({ rol: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('1')
      .setAudience('admin')
      .setIssuer('supera-paes-consola')
      .setIssuedAt(ahora)
      .setExpirationTime(ahora + 60)
      .sign(new TextEncoder().encode(SECRETO_DE_PRUEBA));

    expect((await request(app).get(RUTA_YO).set(conToken(sinSesion))).status).toBe(401);
  });

  it('sin token, ambas interfaces responden 401', async () => {
    const app = crearAppDePrueba();

    expect((await request(app).get(RUTA_YO)).status).toBe(401);
    expect((await request(app).get('/api/v1/app/evaluaciones')).status).toBe(401);
  });

  it('los tokens firmados a mano también quedan separados', async () => {
    const app = crearAppDePrueba();

    const appEnConsola = await request(app)
      .get(RUTA_YO)
      .set(conToken(await tokenApp()));
    const consolaEnApp = await request(app)
      .get('/api/v1/app/evaluaciones')
      .set(conToken(await tokenAdmin()));

    expect(appEnConsola.status).toBe(401);
    expect(consolaEnApp.status).toBe(401);
  });
});

describe('permisos por rol en la consola (CP-05 pasos 2 y 3)', () => {
  async function sesiones() {
    const escenario = crearEscenarioSesiones();
    await escenario.crearCuenta(ADMIN);
    await escenario.crearCuenta(DOCENTE);
    const token = async (cuenta: typeof ADMIN) =>
      conToken(
        (await escenario.ingresar(cuenta.correo, cuenta.contrasena)).body.data
          .tokenAcceso as string,
      );
    return { app: escenario.app, admin: await token(ADMIN), docente: await token(DOCENTE) };
  }

  it.each(['/revision/mis-revisiones', '/revision/desempates'])(
    'el administrador recibe 403 SIN_PERMISO en la ruta del docente %s',
    async (ruta) => {
      const { app, admin } = await sesiones();

      const respuesta = await request(app).get(`${ADMIN_API}${ruta}`).set(admin);

      expect(respuesta.status).toBe(403);
      expect(respuesta.body).toEqual(errorConFormato('SIN_PERMISO'));
    },
  );

  it.each([
    ['get', '/revision/seguimiento'],
    ['get', '/temario/areas'],
    ['get', '/administracion/usuarios-internos'],
    ['post', '/administracion/usuarios-internos'],
    ['patch', '/administracion/usuarios-internos/1'],
    ['post', '/administracion/usuarios-internos/1/activar'],
    ['post', '/administracion/usuarios-internos/1/desactivar'],
  ] as const)(
    'el docente recibe 403 SIN_PERMISO en la ruta de administración %s %s',
    async (metodo, ruta) => {
      const { app, docente } = await sesiones();

      const respuesta = await request(app)[metodo](`${ADMIN_API}${ruta}`).set(docente).send({});

      expect(respuesta.status).toBe(403);
      expect(respuesta.body).toEqual(errorConFormato('SIN_PERMISO'));
    },
  );

  it.each([
    ['docente', '/revision/mis-revisiones'],
    ['docente', '/revision/desempates'],
    ['admin', '/revision/seguimiento'],
  ] as const)('el %s pasa la autorización de %s (todavía 501)', async (rol, ruta) => {
    const tokens = await sesiones();

    const respuesta = await request(tokens.app).get(`${ADMIN_API}${ruta}`).set(tokens[rol]);

    expect(respuesta.status).toBe(501);
  });

  it('los dos roles pueden consultar su propio usuario', async () => {
    const { app, admin, docente } = await sesiones();

    expect((await request(app).get(RUTA_YO).set(admin)).status).toBe(200);
    expect((await request(app).get(RUTA_YO).set(docente)).status).toBe(200);
  });
});
