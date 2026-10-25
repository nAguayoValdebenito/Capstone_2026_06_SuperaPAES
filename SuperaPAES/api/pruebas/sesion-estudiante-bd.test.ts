// Sesión del estudiante contra PostgreSQL real (HU-02.1 en su parte de la app, HU-02.2 por contrato,
// HU-02.3, RNF-01, RNF-02, RN-01): ingreso, dispositivo, cuenta eliminada, correo sin verificar,
// renovación con rotación, sesión mantenida durante 30 días, cierre y límite de intentos.
// CP-04 completo está en sesion-cp04-bd.test.ts.
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  DURACION_TOKEN_ACCESO_SEGUNDOS,
  DURACION_TOKEN_RENOVACION_SEGUNDOS,
} from '../modulos/cuentas/cuentas.servicio.js';
import { errorConFormato } from './ayudantes.js';
import { usarBaseDeSesiones } from './base-sesiones.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import {
  conToken,
  RUTA_APP_PROTEGIDA,
  RUTA_CERRAR_APP,
  RUTA_INGRESO_APP,
  RUTA_RENOVAR_APP,
  sha256,
} from './escenario-sesiones.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';

const EVA = { correo: 'eva@ejemplo.cl', contrasena: 'clave-de-eva-1' };
const SEGUNDOS_30_DIAS = DURACION_TOKEN_RENOVACION_SEGUNDOS.app;

interface FilaSesion {
  hash_token: string;
  dispositivo: string | null;
  expira_en: Date;
  revocado_en: Date | null;
  usuario_interno_id: string | null;
}

type Tokens = { tokenAcceso: string; tokenRenovacion: string };

describe('sesión del estudiante sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('sesión del estudiante con PostgreSQL', () => {
  const entorno = usarBaseDeSesiones('estudiante');

  const ingresar = (correo: string, contrasena: string, extra: Record<string, unknown> = {}) =>
    request(entorno.app)
      .post(RUTA_INGRESO_APP)
      .send({ correo, contrasena, ...extra });
  const renovar = (tokenRenovacion: string) =>
    request(entorno.app).post(RUTA_RENOVAR_APP).send({ tokenRenovacion });
  const cerrar = (tokenRenovacion: string) =>
    request(entorno.app).post(RUTA_CERRAR_APP).send({ tokenRenovacion });
  /** La ruta protegida de la app todavía no tiene endpoints: con sesión válida responde 404. */
  const usarAcceso = (tokenAcceso: string) =>
    request(entorno.app).get(RUTA_APP_PROTEGIDA).set(conToken(tokenAcceso));
  const sesionesDe = async (estudianteId: string) =>
    (
      await entorno.bd.query<FilaSesion>(
        `SELECT hash_token, dispositivo, expira_en, revocado_en, usuario_interno_id::text
           FROM app.token_sesion WHERE estudiante_id = $1 ORDER BY id`,
        [estudianteId],
      )
    ).rows;
  /** Estudiante con sesión abierta. */
  async function conSesion(extra: Record<string, unknown> = {}) {
    const id = await crearEstudianteDePrueba(entorno.bd, EVA);
    const respuesta = await ingresar(EVA.correo, EVA.contrasena, extra);
    expect(respuesta.status).toBe(200);
    return { id, ...(respuesta.body.data as Tokens) };
  }

  describe('ingreso', () => {
    it('entra con tokens y datos mínimos; guarda solo el SHA-256 y vence a los 30 días', async () => {
      const id = await crearEstudianteDePrueba(entorno.bd, {
        ...EVA,
        nombre: 'Eva Estudiante',
        correoVerificado: true,
      });

      const respuesta = await ingresar('Eva@Ejemplo.CL', EVA.contrasena);

      const [fila] = await sesionesDe(id);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({
        data: {
          tokenAcceso: expect.any(String) as string,
          tokenRenovacion: expect.any(String) as string,
          estudiante: { id, nombre: 'Eva Estudiante', correo: EVA.correo, correoVerificado: true },
        },
        error: null,
        meta: null,
      });
      expect(fila?.hash_token).toBe(sha256(respuesta.body.data.tokenRenovacion as string));
      expect(fila).toMatchObject({
        usuario_interno_id: null,
        dispositivo: null,
        revocado_en: null,
      });
      expect(fila?.expira_en.getTime()).toBe(entorno.ahora().getTime() + SEGUNDOS_30_DIAS * 1000);
      expect((await usarAcceso(respuesta.body.data.tokenAcceso as string)).status).toBe(404);
    });

    it('un correo sin verificar sí inicia sesión (solo tiene el cupo de RN-01)', async () => {
      await crearEstudianteDePrueba(entorno.bd, { ...EVA, correoVerificado: false });

      const respuesta = await ingresar(EVA.correo, EVA.contrasena);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.data.estudiante.correoVerificado).toBe(false);
    });

    it('contraseña incorrecta y correo inexistente reciben la misma respuesta, sin sesión', async () => {
      const id = await crearEstudianteDePrueba(entorno.bd, EVA);

      const malaClave = await ingresar(EVA.correo, 'otra-clave-1');
      const sinCuenta = await ingresar('nadie@ejemplo.cl', EVA.contrasena);

      expect(malaClave.status).toBe(401);
      expect(malaClave.body).toEqual(errorConFormato('NO_AUTENTICADO'));
      expect(sinCuenta.status).toBe(401);
      expect(sinCuenta.body).toEqual(malaClave.body);
      expect(await sesionesDe(id)).toEqual([]);
    });

    it('con un correo inexistente compara igual contra un hash de relleno (el tiempo no lo delata)', async () => {
      await crearEstudianteDePrueba(entorno.bd, EVA);
      const comparar = vi.spyOn(bcrypt, 'compare');

      await ingresar('nadie@ejemplo.cl', 'cualquier-clave');
      await ingresar(EVA.correo, 'otra-clave-1');

      expect(comparar).toHaveBeenCalledTimes(2);
    });

    it('una cuenta eliminada no entra y recibe el mismo mensaje que una contraseña incorrecta', async () => {
      const id = await crearEstudianteDePrueba(entorno.bd, { ...EVA, eliminado: true });

      const correcta = await ingresar(EVA.correo, EVA.contrasena);
      const incorrecta = await ingresar(EVA.correo, 'otra-clave-1');

      expect(correcta.status).toBe(401);
      expect(correcta.body).toEqual(incorrecta.body);
      expect(await sesionesDe(id)).toEqual([]);
    });

    it('guarda el nombre del dispositivo (hasta 100 caracteres) y rechaza uno más largo', async () => {
      const id = await crearEstudianteDePrueba(entorno.bd, EVA);

      const conNombre = await ingresar(EVA.correo, EVA.contrasena, { dispositivo: '  Pixel 8  ' });
      const vacio = await ingresar(EVA.correo, EVA.contrasena, { dispositivo: '' });
      const largo = await ingresar(EVA.correo, EVA.contrasena, { dispositivo: 'x'.repeat(101) });
      const justo = await ingresar(EVA.correo, EVA.contrasena, { dispositivo: 'x'.repeat(100) });

      expect((await sesionesDe(id)).map((f) => f.dispositivo)).toEqual([
        'Pixel 8',
        null,
        'x'.repeat(100),
      ]);
      expect([conNombre.status, vacio.status, justo.status]).toEqual([200, 200, 200]);
      expect(largo.status).toBe(400);
      expect(largo.body.error.codigo).toBe('VALIDACION');
    });

    it('ninguna respuesta incluye hash_contrasena ni hash_token', async () => {
      const id = await crearEstudianteDePrueba(entorno.bd, EVA);
      const ingreso = await ingresar(EVA.correo, EVA.contrasena);
      const { tokenRenovacion } = ingreso.body.data as Tokens;
      const renovada = await renovar(tokenRenovacion);
      const respuestas = [
        ingreso,
        renovada,
        await renovar(tokenRenovacion),
        await cerrar(renovada.body.data.tokenRenovacion as string),
        await ingresar(EVA.correo, 'otra-clave-1'),
      ];

      const textos = respuestas.map((r) => JSON.stringify(r.body));
      const { rows } = await entorno.bd.query<{ h: string }>(
        `SELECT hash_contrasena AS h FROM app.estudiante WHERE id = $1
         UNION ALL SELECT hash_token FROM app.token_sesion WHERE estudiante_id = $1`,
        [id],
      );
      expect(rows).toHaveLength(3);
      for (const texto of textos) {
        expect(texto).not.toMatch(/hash|\$2[aby]\$/i);
        for (const { h } of rows) expect(texto).not.toContain(h);
      }
    });
  });

  describe('renovación y sesión mantenida (HU-02 escenario 2)', () => {
    it('entrega tokens nuevos; el anterior ya no renueva ni da acceso, y se conserva el dispositivo', async () => {
      const primera = await conSesion({ dispositivo: 'Pixel 8' });

      const renovada = await renovar(primera.tokenRenovacion);
      const otraVez = await renovar(primera.tokenRenovacion);

      const filas = await sesionesDe(primera.id);
      expect(renovada.status).toBe(200);
      expect(renovada.body.data.tokenRenovacion).not.toBe(primera.tokenRenovacion);
      expect(otraVez.status).toBe(401);
      expect(otraVez.body).toEqual(errorConFormato('NO_AUTENTICADO'));
      expect((await usarAcceso(primera.tokenAcceso)).status).toBe(401);
      expect((await usarAcceso(renovada.body.data.tokenAcceso as string)).status).toBe(404);
      expect(filas.map((f) => [f.dispositivo, f.revocado_en !== null])).toEqual([
        ['Pixel 8', true],
        ['Pixel 8', false],
      ]);
      expect(filas[1]?.hash_token).toBe(sha256(renovada.body.data.tokenRenovacion as string));
    });

    it('dos renovaciones a la vez con el mismo token: solo una tiene éxito', async () => {
      const { tokenRenovacion, id } = await conSesion();

      const estados = (await Promise.all([renovar(tokenRenovacion), renovar(tokenRenovacion)])).map(
        (r) => r.status,
      );

      expect(estados.sort()).toEqual([200, 401]);
      expect((await sesionesDe(id)).filter((f) => f.revocado_en === null)).toHaveLength(1);
    });

    it('el token de acceso vence a los 15 minutos y la app renueva en silencio, sin contraseña', async () => {
      const sesion = await conSesion();

      entorno.avanzarSegundos(DURACION_TOKEN_ACCESO_SEGUNDOS + 1);
      const vencido = await usarAcceso(sesion.tokenAcceso);
      const renovada = await renovar(sesion.tokenRenovacion);

      expect(vencido.status).toBe(401);
      expect(vencido.body.error.codigo).toBe('NO_AUTENTICADO');
      expect(renovada.status).toBe(200);
      expect((await usarAcceso(renovada.body.data.tokenAcceso as string)).status).toBe(404);
    });

    it('los 30 días cuentan desde la última renovación; sin usar la app durante 30 días se rechaza', async () => {
      let { tokenRenovacion } = await conSesion();

      for (let i = 0; i < 3; i++) {
        entorno.avanzarSegundos(SEGUNDOS_30_DIAS - 60);
        const renovada = await renovar(tokenRenovacion);
        expect(renovada.status).toBe(200);
        tokenRenovacion = renovada.body.data.tokenRenovacion as string;
      }
      entorno.avanzarSegundos(SEGUNDOS_30_DIAS);
      const vencida = await renovar(tokenRenovacion);

      expect(vencida.status).toBe(401);
      expect(vencida.body).toEqual(errorConFormato('NO_AUTENTICADO'));
    });

    it('la cuenta eliminada con una sesión abierta pierde el acceso y la renovación', async () => {
      const sesion = await conSesion();

      await entorno.bd.query('UPDATE app.estudiante SET eliminado_en = now() WHERE id = $1', [
        sesion.id,
      ]);

      expect((await usarAcceso(sesion.tokenAcceso)).status).toBe(401);
      expect((await renovar(sesion.tokenRenovacion)).status).toBe(401);
    });

    it('un token inventado responde 401 y un cuerpo sin token, 400', async () => {
      const inventado = await renovar('no-existe');
      const sinToken = await request(entorno.app).post(RUTA_RENOVAR_APP).send({});

      expect(inventado.status).toBe(401);
      expect(sinToken.status).toBe(400);
    });
  });

  describe('cerrar la sesión (HU-02 escenario 3)', () => {
    it('revoca la fila: no se puede renovar y el token de acceso deja de servir', async () => {
      const sesion = await conSesion();

      const cierre = await cerrar(sesion.tokenRenovacion);

      const [fila] = await sesionesDe(sesion.id);
      expect(cierre.status).toBe(200);
      expect(cierre.body).toEqual({ data: { sesionCerrada: true }, error: null, meta: null });
      expect(fila?.revocado_en).toEqual(entorno.ahora());
      expect((await renovar(sesion.tokenRenovacion)).status).toBe(401);
      expect((await usarAcceso(sesion.tokenAcceso)).status).toBe(401);
    });

    it('responde igual si ya estaba cerrada o el token no existe, y funciona con el acceso vencido', async () => {
      const sesion = await conSesion();
      entorno.avanzarSegundos(DURACION_TOKEN_ACCESO_SEGUNDOS + 60);

      const primera = await cerrar(sesion.tokenRenovacion);
      const segunda = await cerrar(sesion.tokenRenovacion);
      const inventado = await cerrar('no-existe');

      expect(segunda.body).toEqual(primera.body);
      expect(inventado.body).toEqual(primera.body);
      expect((await renovar(sesion.tokenRenovacion)).status).toBe(401);
    });

    it('cerrar la sesión de un teléfono no cierra la de otro', async () => {
      const id = await crearEstudianteDePrueba(entorno.bd, EVA);
      const telefono = (await ingresar(EVA.correo, EVA.contrasena)).body.data as Tokens;
      const tablet = (await ingresar(EVA.correo, EVA.contrasena)).body.data as Tokens;

      await cerrar(telefono.tokenRenovacion);

      expect((await usarAcceso(tablet.tokenAcceso)).status).toBe(404);
      expect((await sesionesDe(id)).map((f) => f.revocado_en !== null)).toEqual([true, false]);
    });
  });

  describe('límite de intentos del ingreso (RNF-02)', () => {
    const limite = { ventanaMs: 60_000, maximo: 2 };
    const desde =
      (app: ReturnType<typeof entorno.crearAppConLimite>, ip: string) =>
      (correo: string, contrasena: string) =>
        request(app).post(RUTA_INGRESO_APP).set('X-Forwarded-For', ip).send({ correo, contrasena });

    it('por correo: los intentos fallidos desde distintas IP cuentan para la misma cuenta', async () => {
      await crearEstudianteDePrueba(entorno.bd, EVA);
      const app = entorno.crearAppConLimite(limite);
      await desde(app, '203.0.113.1')(EVA.correo, 'mala-1');
      await desde(app, '203.0.113.2')(EVA.correo, 'mala-2');

      const tercero = await desde(app, '203.0.113.3')(EVA.correo, EVA.contrasena);

      expect(tercero.status).toBe(429);
      expect(tercero.body).toEqual(errorConFormato('DEMASIADOS_INTENTOS'));
    });

    it('por IP: los intentos fallidos con distintos correos cuentan para la misma IP', async () => {
      await crearEstudianteDePrueba(entorno.bd, EVA);
      const app = entorno.crearAppConLimite(limite);
      await desde(app, '203.0.113.1')('uno@ejemplo.cl', 'mala-1');
      await desde(app, '203.0.113.1')('dos@ejemplo.cl', 'mala-2');

      const tercero = await desde(app, '203.0.113.1')(EVA.correo, EVA.contrasena);

      expect(tercero.status).toBe(429);
    });

    it('los ingresos correctos no cuentan (laboratorios con una sola IP)', async () => {
      await crearEstudianteDePrueba(entorno.bd, EVA);
      const app = entorno.crearAppConLimite(limite);
      const estados = [];

      for (let i = 0; i < 3; i++) {
        estados.push((await desde(app, '203.0.113.1')(EVA.correo, EVA.contrasena)).status);
      }

      expect(estados).toEqual([200, 200, 200]);
    });
  });
});
