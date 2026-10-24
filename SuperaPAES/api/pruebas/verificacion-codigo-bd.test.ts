// Código de verificación de 6 dígitos contra PostgreSQL real (HU-05.4 parte servidor, HU-05 escenario
// 5, RN-32, CP-55): un solo uso, 5 intentos con el intento fallido guardado aunque la respuesta sea un
// error, vencimiento a las 24 horas con el reloj adelantado, código cifrado en la base, enlace que
// sigue sirviendo con el código agotado y correo nuevo que anula el enlace y el código anteriores.
import { createHash } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { cifrarCodigo } from '../modulos/cuentas/cuentas.verificacion.servicio.js';
import { CLAVE_CODIGO_DE_PRUEBA, errorConFormato } from './ayudantes.js';
import { usarBaseDeSesiones } from './base-sesiones.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import {
  estudianteConSesion,
  HORAS_VERIFICACION,
  otroCodigo,
  pedirCorreo,
  RUTA_CODIGO,
  verificarConCodigo,
  verificarConEnlace,
} from './verificacion-de-prueba.js';

const INTENTOS = 5;

describe('código de verificación sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('código de verificación con PostgreSQL (CP-55)', () => {
  const entorno = usarBaseDeSesiones('codigo');

  const filaDe = async (estudianteId: string) =>
    (
      await entorno.bd.query<{
        intentos: number;
        usado: boolean;
        anulado: boolean;
        hash_token: string;
        hash_codigo: string;
      }>(
        `SELECT intentos_fallidos AS intentos, usado_en IS NOT NULL AS usado,
                anulado_en IS NOT NULL AS anulado, hash_token, hash_codigo
           FROM app.token_correo WHERE estudiante_id = $1 ORDER BY id DESC LIMIT 1`,
        [estudianteId],
      )
    ).rows[0];
  const verificado = async (estudianteId: string) =>
    (
      await entorno.bd.query<{ v: boolean }>(
        'SELECT correo_verificado AS v FROM app.estudiante WHERE id = $1',
        [estudianteId],
      )
    ).rows[0]?.v;

  /** Escribe el código equivocado las veces indicadas y devuelve las respuestas. */
  async function fallar(sesion: Record<string, string>, codigo: string, veces: number) {
    const respuestas = [];
    for (let i = 0; i < veces; i++) {
      respuestas.push(await verificarConCodigo(entorno, sesion, otroCodigo(codigo)));
    }
    return respuestas;
  }

  it('paso 1: el código correcto verifica y no sirve una segunda vez', async () => {
    const eva = await estudianteConSesion(entorno);
    const { codigo } = await pedirCorreo(entorno, eva.sesion);

    const primera = await verificarConCodigo(entorno, eva.sesion, codigo);
    entorno.avanzarSegundos(60);
    const segunda = await verificarConCodigo(entorno, eva.sesion, codigo);

    expect(primera.status).toBe(200);
    expect(primera.body.data).toEqual({ verificado: true, yaVerificado: false });
    // La segunda vez no verifica nada: la cuenta ya estaba verificada y el correo, usado.
    expect(segunda.body.data).toEqual({ verificado: true, yaVerificado: true });
    expect(await filaDe(eva.id)).toMatchObject({ usado: true, intentos: 0 });
  });

  it('paso 2: con códigos incorrectos indica los intentos que quedan y al quinto el código deja de servir', async () => {
    const eva = await estudianteConSesion(entorno);
    const { codigo } = await pedirCorreo(entorno, eva.sesion);

    const fallidas = await fallar(eva.sesion, codigo, INTENTOS);
    const correcta = await verificarConCodigo(entorno, eva.sesion, codigo);

    expect(fallidas.slice(0, 4).map((r) => [r.status, r.body.error.detalles as unknown])).toEqual([
      [400, { intentosRestantes: 4 }],
      [400, { intentosRestantes: 3 }],
      [400, { intentosRestantes: 2 }],
      [400, { intentosRestantes: 1 }],
    ]);
    expect(fallidas[0]?.body.error.codigo).toBe('CODIGO_INCORRECTO');
    expect(fallidas[4]?.status).toBe(409);
    expect(fallidas[4]?.body).toEqual(errorConFormato('CODIGO_AGOTADO'));
    expect(correcta.status).toBe(409);
    expect(correcta.body.error).toMatchObject({
      codigo: 'CODIGO_AGOTADO',
      mensaje: expect.stringMatching(/correo nuevo/) as string,
    });
    expect(await verificado(eva.id)).toBe(false);
  });

  it('el intento fallido queda guardado aunque la respuesta sea un error, y un sexto intento no consulta el código', async () => {
    const eva = await estudianteConSesion(entorno);
    const { codigo } = await pedirCorreo(entorno, eva.sesion);

    await fallar(eva.sesion, codigo, 1);
    const trasUno = await filaDe(eva.id);
    await fallar(eva.sesion, codigo, INTENTOS - 1);
    const sexto = await verificarConCodigo(entorno, eva.sesion, otroCodigo(codigo));

    expect(trasUno?.intentos).toBe(1);
    // El trigger impide pasar de 5: si el sexto intento sumara, la API respondería 500.
    expect(sexto.status).toBe(409);
    expect(sexto.body.error.codigo).toBe('CODIGO_AGOTADO');
    expect(await filaDe(eva.id)).toMatchObject({
      intentos: INTENTOS,
      usado: false,
      anulado: false,
    });
  });

  it('paso 3: el código con más de 24 horas se rechaza sin gastar intentos', async () => {
    const eva = await estudianteConSesion(entorno);
    const { codigo } = await pedirCorreo(entorno, eva.sesion);
    entorno.avanzarSegundos(HORAS_VERIFICACION * 3600 + 1);

    const respuesta = await verificarConCodigo(entorno, await eva.nuevaSesion(), codigo);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual(errorConFormato('VERIFICACION_NO_VIGENTE'));
    expect(await filaDe(eva.id)).toMatchObject({ intentos: 0, usado: false });
    expect(await verificado(eva.id)).toBe(false);
  });

  it('paso 4: en la base el código está cifrado con HMAC y la clave del servidor, no en texto plano', async () => {
    const eva = await estudianteConSesion(entorno);
    const { token, codigo } = await pedirCorreo(entorno, eva.sesion);

    const fila = await filaDe(eva.id);

    const hashToken = createHash('sha256').update(token).digest('hex');
    expect(fila?.hash_codigo).toMatch(/^[0-9a-f]{64}$/);
    expect(fila?.hash_codigo).not.toContain(codigo);
    expect(fila?.hash_codigo).toBe(cifrarCodigo(CLAVE_CODIGO_DE_PRUEBA, hashToken, codigo));
    // Sin la clave no se puede reproducir: el mismo código con otra clave da otro valor.
    expect(fila?.hash_codigo).not.toBe(cifrarCodigo('otra-clave', hashToken, codigo));
    expect(fila?.hash_codigo).not.toBe(createHash('sha256').update(codigo).digest('hex'));
  });

  it('con el código agotado, el enlace del mismo correo sigue verificando (RN-32: solo el código deja de servir)', async () => {
    const eva = await estudianteConSesion(entorno);
    const { token, codigo } = await pedirCorreo(entorno, eva.sesion);
    await fallar(eva.sesion, codigo, INTENTOS);

    const conCodigo = await verificarConCodigo(entorno, eva.sesion, codigo);
    const conEnlace = await verificarConEnlace(entorno, token);

    expect(conCodigo.body.error.codigo).toBe('CODIGO_AGOTADO');
    expect(conEnlace.status).toBe(200);
    expect(conEnlace.body.data).toEqual({ verificado: true, yaVerificado: false });
    expect(await verificado(eva.id)).toBe(true);
  });

  it('un correo nuevo anula el enlace y el código anteriores, también con el código agotado (escenario 3)', async () => {
    const eva = await estudianteConSesion(entorno);
    const anterior = await pedirCorreo(entorno, eva.sesion);
    await fallar(eva.sesion, anterior.codigo, INTENTOS);
    const nuevo = await pedirCorreo(entorno, eva.sesion);

    const enlaceAnterior = await verificarConEnlace(entorno, anterior.token);
    const codigoAnterior = await verificarConCodigo(entorno, eva.sesion, anterior.codigo);
    const codigoNuevo = await verificarConCodigo(entorno, eva.sesion, nuevo.codigo);

    expect(enlaceAnterior.status).toBe(409);
    expect(enlaceAnterior.body.error.codigo).toBe('VERIFICACION_NO_VIGENTE');
    // El código anterior se compara con el correo vigente, el nuevo, y no coincide: un intento menos.
    expect(codigoAnterior.status).toBe(400);
    expect(codigoAnterior.body.error).toMatchObject({
      codigo: 'CODIGO_INCORRECTO',
      detalles: { intentosRestantes: 4 },
    });
    expect(codigoNuevo.body.data).toEqual({ verificado: true, yaVerificado: false });
  });

  it('quien ya verificó con el enlace recibe 200 con cualquier código, sin gastar intentos', async () => {
    const eva = await estudianteConSesion(entorno);
    const { token, codigo } = await pedirCorreo(entorno, eva.sesion);
    await verificarConEnlace(entorno, token);

    const respuesta = await verificarConCodigo(entorno, eva.sesion, otroCodigo(codigo));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({ verificado: true, yaVerificado: true });
  });

  it('sin un correo emitido responde VERIFICACION_NO_VIGENTE', async () => {
    const eva = await estudianteConSesion(entorno);

    const respuesta = await verificarConCodigo(entorno, eva.sesion, '123456');

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe('VERIFICACION_NO_VIGENTE');
  });

  it('el código exige la sesión de la app (401) y 6 dígitos (400)', async () => {
    const eva = await estudianteConSesion(entorno);

    const sinSesion = await request(entorno.app).post(RUTA_CODIGO).send({ codigo: '123456' });
    const corto = await verificarConCodigo(entorno, eva.sesion, '12345');
    const letras = await verificarConCodigo(entorno, eva.sesion, 'abcdef');

    expect(sinSesion.status).toBe(401);
    expect(sinSesion.body).toEqual(errorConFormato('NO_AUTENTICADO'));
    expect(corto.status).toBe(400);
    expect(letras.body.error.codigo).toBe('VALIDACION');
  });
});
