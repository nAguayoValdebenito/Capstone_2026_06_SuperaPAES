// CP-04 completo contra PostgreSQL real (HU-02.3, HU-03, RNF-01): las sesiones de la app y de la
// consola están separadas y se cierran de forma segura. Cada paso del caso tiene su prueba:
//   1. Iniciar sesión en la app con el estudiante.
//   2. Usar esa sesión para pedir una página de la consola (y la de la consola, una de la app).
//   3. Intentar entrar a la consola con la cuenta de estudiante.
//   4. Cerrar sesión en la app y reutilizar la sesión anterior.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorConFormato } from './ayudantes.js';
import { usarBaseDeSesiones } from './base-sesiones.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import {
  conToken,
  RUTA_APP_PROTEGIDA,
  RUTA_CERRAR_APP,
  RUTA_INGRESO,
  RUTA_INGRESO_APP,
  RUTA_RENOVAR,
  RUTA_RENOVAR_APP,
  RUTA_USUARIOS,
  RUTA_YO,
} from './escenario-sesiones.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';

const EVA = { correo: 'eva@ejemplo.cl', contrasena: 'clave-de-eva-1' };

type Tokens = { tokenAcceso: string; tokenRenovacion: string };

describe('CP-04 sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)(
  'CP-04 con PostgreSQL: sesiones separadas y cerradas de forma segura',
  () => {
    const entorno = usarBaseDeSesiones('cp04');

    /** Paso 1: el estudiante inicia sesión en la app. */
    async function estudianteEnLaApp() {
      await crearEstudianteDePrueba(entorno.bd, EVA);
      const respuesta = await request(entorno.app).post(RUTA_INGRESO_APP).send(EVA);
      expect(respuesta.status).toBe(200);
      return respuesta.body.data as Tokens;
    }

    async function administradorEnLaConsola() {
      const credenciales = await entorno.crearAdmin();
      const respuesta = await request(entorno.app).post(RUTA_INGRESO).send(credenciales);
      expect(respuesta.status).toBe(200);
      return respuesta.body.data as Tokens;
    }

    it('paso 2: la sesión de la app se rechaza en las rutas de la consola', async () => {
      const { tokenAcceso } = await estudianteEnLaApp();

      const yo = await request(entorno.app).get(RUTA_YO).set(conToken(tokenAcceso));
      const usuarios = await request(entorno.app).get(RUTA_USUARIOS).set(conToken(tokenAcceso));

      expect(yo.status).toBe(401);
      expect(yo.body).toEqual(errorConFormato('NO_AUTENTICADO'));
      expect(usuarios.status).toBe(401);
      // La misma sesión sí sirve en la app.
      const enApp = await request(entorno.app).get(RUTA_APP_PROTEGIDA).set(conToken(tokenAcceso));
      expect(enApp.status).toBe(404);
    });

    it('paso 2: la sesión de la consola se rechaza en las rutas de la app', async () => {
      const { tokenAcceso } = await administradorEnLaConsola();

      const respuesta = await request(entorno.app)
        .get(RUTA_APP_PROTEGIDA)
        .set(conToken(tokenAcceso));

      expect(respuesta.status).toBe(401);
      expect(respuesta.body).toEqual(errorConFormato('NO_AUTENTICADO'));
    });

    it('paso 2: el token de renovación de una interfaz no renueva en la otra', async () => {
      const estudiante = await estudianteEnLaApp();
      const administrador = await administradorEnLaConsola();

      const appEnConsola = await request(entorno.app)
        .post(RUTA_RENOVAR)
        .send({ tokenRenovacion: estudiante.tokenRenovacion });
      const consolaEnApp = await request(entorno.app)
        .post(RUTA_RENOVAR_APP)
        .send({ tokenRenovacion: administrador.tokenRenovacion });

      expect(appEnConsola.status).toBe(401);
      expect(consolaEnApp.status).toBe(401);
      // Los intentos cruzados no gastaron ninguna de las dos sesiones.
      const sirven = await request(entorno.app)
        .post(RUTA_RENOVAR_APP)
        .send({ tokenRenovacion: estudiante.tokenRenovacion });
      expect(sirven.status).toBe(200);
    });

    it('paso 3: el estudiante no puede entrar a la consola con su correo y contraseña', async () => {
      await estudianteEnLaApp();
      await entorno.crearAdmin();

      const respuesta = await request(entorno.app).post(RUTA_INGRESO).send(EVA);

      const { rows } = await entorno.bd.query(
        'SELECT 1 FROM app.token_sesion WHERE usuario_interno_id IS NOT NULL',
      );
      expect(respuesta.status).toBe(401);
      expect(respuesta.body.error.codigo).toBe('NO_AUTENTICADO');
      expect(rows).toEqual([]);
    });

    it('paso 4: la sesión cerrada en la app ya no sirve', async () => {
      const { tokenAcceso, tokenRenovacion } = await estudianteEnLaApp();

      const cierre = await request(entorno.app).post(RUTA_CERRAR_APP).send({ tokenRenovacion });

      const acceso = await request(entorno.app).get(RUTA_APP_PROTEGIDA).set(conToken(tokenAcceso));
      const renovar = await request(entorno.app).post(RUTA_RENOVAR_APP).send({ tokenRenovacion });
      expect(cierre.status).toBe(200);
      expect(acceso.status).toBe(401);
      expect(acceso.body).toEqual(errorConFormato('NO_AUTENTICADO'));
      expect(renovar.status).toBe(401);
    });
  },
);
