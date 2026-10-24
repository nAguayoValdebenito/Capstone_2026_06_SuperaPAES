// Correo de verificación y verificación con el enlace contra PostgreSQL real (HU-05.1, RF-A03, RN-32,
// CU-02): contenido del correo, enlace y código guardados cifrados, verificación sin sesión,
// idempotencia para quien ya verificó, reenvío que anula el correo anterior (escenario 3), enlace
// vencido o inexistente (CU-02 3.b), límite del reenvío, envío fallido sin datos en el registro y CORS.
import { createHash } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { cifrarCodigo } from '../modulos/cuentas/cuentas.verificacion.servicio.js';
import { CLAVE_CODIGO_DE_PRUEBA, errorConFormato, URL_CONSOLA_DE_PRUEBA } from './ayudantes.js';
import { usarBaseDeSesiones } from './base-sesiones.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import {
  estudianteConSesion,
  HORAS_VERIFICACION,
  pedirCorreo,
  RUTA_ENLACE,
  RUTA_REENVIAR,
  verificarConEnlace,
} from './verificacion-de-prueba.js';

const sha256 = (texto: string) => createHash('sha256').update(texto).digest('hex');

interface FilaToken {
  hash_token: string;
  hash_codigo: string;
  expira_en: Date;
  intentos_fallidos: number;
  usado_en: Date | null;
  anulado_en: Date | null;
}

describe('verificación del correo sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('correo de verificación y enlace con PostgreSQL', () => {
  const entorno = usarBaseDeSesiones('verificacion');

  const tokensDe = async (estudianteId: string) =>
    (
      await entorno.bd.query<FilaToken>(
        `SELECT hash_token, hash_codigo, expira_en, intentos_fallidos, usado_en, anulado_en
           FROM app.token_correo WHERE estudiante_id = $1 ORDER BY id`,
        [estudianteId],
      )
    ).rows;
  const estudiante = async (id: string) =>
    (
      await entorno.bd.query<{ correo_verificado: boolean; verificado_en: Date | null }>(
        'SELECT correo_verificado, verificado_en FROM app.estudiante WHERE id = $1',
        [id],
      )
    ).rows[0];

  it('emite un correo en español con el enlace a la consola y el código; guarda solo el SHA-256 y el HMAC', async () => {
    const eva = await estudianteConSesion(entorno);

    const { respuesta, token, codigo } = await pedirCorreo(entorno, eva.sesion);

    const [mensaje] = entorno.correos;
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({ enviado: true, yaVerificado: false });
    expect(mensaje).toMatchObject({
      para: eva.correo,
      asunto: 'Verifica tu correo en Supera PAES',
    });
    expect(mensaje?.texto).toContain(`${URL_CONSOLA_DE_PRUEBA}/verificar-correo?token=${token}`);
    expect(mensaje?.texto).toMatch(/vencen en 24 horas[\s\S]*5 intentos/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    const [fila] = await tokensDe(eva.id);
    expect(fila?.hash_token).toBe(sha256(token));
    expect(fila?.hash_codigo).not.toContain(codigo);
    expect(fila?.hash_codigo).toBe(cifrarCodigo(CLAVE_CODIGO_DE_PRUEBA, sha256(token), codigo));
    expect(fila?.expira_en.getTime()).toBe(
      entorno.ahora().getTime() + HORAS_VERIFICACION * 3600 * 1000,
    );
    expect(fila).toMatchObject({ intentos_fallidos: 0, usado_en: null, anulado_en: null });
  });

  it('verifica con el enlace sin sesión: marca el correo y el enlace como usados', async () => {
    const eva = await estudianteConSesion(entorno);
    const { token } = await pedirCorreo(entorno, eva.sesion);

    const respuesta = await verificarConEnlace(entorno, token);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      data: { verificado: true, yaVerificado: false },
      error: null,
      meta: null,
    });
    expect(await estudiante(eva.id)).toEqual({
      correo_verificado: true,
      verificado_en: entorno.ahora(),
    });
    expect((await tokensDe(eva.id))[0]?.usado_en).toEqual(entorno.ahora());
  });

  it('para quien ya verificó es idempotente: no falla ni cambia nada', async () => {
    const eva = await estudianteConSesion(entorno);
    const { token } = await pedirCorreo(entorno, eva.sesion);
    await verificarConEnlace(entorno, token);
    const verificadoEn = entorno.ahora();
    entorno.avanzarSegundos(60);

    const otraVez = await verificarConEnlace(entorno, token);

    expect(otraVez.status).toBe(200);
    expect(otraVez.body.data).toEqual({ verificado: true, yaVerificado: true });
    expect((await estudiante(eva.id))?.verificado_en).toEqual(verificadoEn);
  });

  it('reenviar anula el enlace anterior (escenario 3) y el nuevo sí verifica', async () => {
    const eva = await estudianteConSesion(entorno);
    const primero = await pedirCorreo(entorno, eva.sesion);
    const segundo = await pedirCorreo(entorno, eva.sesion);

    const conElAnterior = await verificarConEnlace(entorno, primero.token);
    const conElNuevo = await verificarConEnlace(entorno, segundo.token);

    expect(conElAnterior.status).toBe(409);
    expect(conElAnterior.body).toEqual(errorConFormato('VERIFICACION_NO_VIGENTE'));
    expect(conElNuevo.body.data).toEqual({ verificado: true, yaVerificado: false });
    const filas = await tokensDe(eva.id);
    expect(filas.map((f) => [f.anulado_en !== null, f.usado_en !== null])).toEqual([
      [true, false],
      [false, true],
    ]);
  });

  it('rechaza un enlace vencido o inexistente y ofrece pedir un correo nuevo (CU-02 3.b)', async () => {
    const eva = await estudianteConSesion(entorno);
    const { token } = await pedirCorreo(entorno, eva.sesion);
    entorno.avanzarSegundos(HORAS_VERIFICACION * 3600 + 1);

    const vencido = await verificarConEnlace(entorno, token);
    const inexistente = await verificarConEnlace(entorno, 'no-existe');
    const sinToken = await request(entorno.app).post(RUTA_ENLACE).send({});

    expect(vencido.status).toBe(409);
    expect(vencido.body.error).toMatchObject({
      codigo: 'VERIFICACION_NO_VIGENTE',
      mensaje: expect.stringMatching(/otro correo/) as string,
    });
    expect(inexistente.body.error.codigo).toBe('VERIFICACION_NO_VIGENTE');
    expect(sinToken.status).toBe(400);
    expect((await estudiante(eva.id))?.correo_verificado).toBe(false);
  });

  it('reenviar a quien ya verificó responde sin error y no emite nada', async () => {
    const eva = await estudianteConSesion(entorno);
    await verificarConEnlace(entorno, (await pedirCorreo(entorno, eva.sesion)).token);

    const respuesta = await request(entorno.app).post(RUTA_REENVIAR).set(eva.sesion);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({ enviado: false, yaVerificado: true });
    expect(entorno.correos).toHaveLength(1);
    expect(await tokensDe(eva.id)).toHaveLength(1);
  });

  it('reenviar exige la sesión de la app', async () => {
    const respuesta = await request(entorno.app).post(RUTA_REENVIAR);

    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual(errorConFormato('NO_AUTENTICADO'));
  });

  it('reenviar está limitado a 3 correos por hora por estudiante', async () => {
    const app = entorno.crearAppConLimite({ ventanaMs: 60_000, maximo: 100 });
    const eva = await estudianteConSesion(entorno);

    const estados = [];
    for (let i = 0; i < 4; i++) {
      estados.push((await request(app).post(RUTA_REENVIAR).set(eva.sesion)).status);
    }

    expect(estados).toEqual([200, 200, 200, 429]);
    expect(entorno.correos).toHaveLength(3);
  });

  it('si el correo no sale, el correo emitido queda, se puede pedir otro y el registro no muestra el enlace, el código ni el correo', async () => {
    const eva = await estudianteConSesion(entorno);
    const registrar = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    entorno.fallarCorreo(true);

    const fallido = await pedirCorreo(entorno, eva.sesion);

    expect(fallido.respuesta.status).toBe(200);
    expect(fallido.respuesta.body.data).toEqual({ enviado: false, yaVerificado: false });
    expect(await tokensDe(eva.id)).toHaveLength(1);
    const registro = registrar.mock.calls.map((llamada) => llamada.join(' ')).join('\n');
    expect(registro).toContain('No se pudo enviar el correo de verificación');
    expect(registro).toContain(eva.id);
    for (const dato of [fallido.token, fallido.codigo, eva.correo]) {
      expect(registro).not.toContain(dato);
    }
    entorno.fallarCorreo(false);
    const reintento = await pedirCorreo(entorno, eva.sesion);
    expect(reintento.respuesta.body.data).toEqual({ enviado: true, yaVerificado: false });
    expect((await verificarConEnlace(entorno, reintento.token)).status).toBe(200);
  });

  it('CORS permite a la consola llamar a la verificación con el enlace', async () => {
    const preflight = (origen: string) =>
      request(entorno.app)
        .options(RUTA_ENLACE)
        .set('Origin', origen)
        .set('Access-Control-Request-Method', 'POST');

    const consola = await preflight(URL_CONSOLA_DE_PRUEBA);
    const otro = await preflight('https://otro-sitio.ejemplo');

    expect(consola.headers['access-control-allow-origin']).toBe(URL_CONSOLA_DE_PRUEBA);
    expect(otro.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('ninguna respuesta incluye hashes ni el código', async () => {
    const eva = await estudianteConSesion(entorno);
    const primero = await pedirCorreo(entorno, eva.sesion);
    const segundo = await pedirCorreo(entorno, eva.sesion);
    const respuestas = [
      primero.respuesta,
      segundo.respuesta,
      await verificarConEnlace(entorno, primero.token),
      await verificarConEnlace(entorno, segundo.token),
      await verificarConEnlace(entorno, segundo.token),
    ];

    const filas = await tokensDe(eva.id);
    for (const texto of respuestas.map((r) => JSON.stringify(r.body))) {
      expect(texto).not.toMatch(/hash/i);
      for (const dato of [primero.codigo, segundo.codigo]) expect(texto).not.toContain(dato);
      for (const fila of filas) {
        expect(texto).not.toContain(fila.hash_token);
        expect(texto).not.toContain(fila.hash_codigo);
      }
    }
  });
});
