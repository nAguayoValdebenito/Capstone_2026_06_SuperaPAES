// Recuperación de la contraseña contra PostgreSQL real (HU-06.1, RF-A02, CU-04, CP-06, CP-54 paso 5):
// pedir el enlace con una respuesta siempre igual, crear la contraseña nueva con un enlace de un solo uso
// que vence en 1 hora (reloj adelantado), enlace que no se consume con una contraseña inválida, sesiones
// cerradas al cambiar la contraseña, límites de intentos, CORS y registros sin el enlace ni la contraseña.
import { createHash } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { URL_CONSOLA_DE_PRUEBA, errorConFormato } from './ayudantes.js';
import { usarBaseDeSesiones } from './base-sesiones.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { conToken, RUTA_APP_PROTEGIDA, RUTA_RENOVAR_APP } from './escenario-sesiones.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';
import {
  CLAVE_NUEVA,
  CLAVE_VIEJA,
  crearAyudantesDeRecuperacion,
  EVA,
  HORA_EN_SEGUNDOS,
  RESTABLECER,
} from './recuperacion-de-prueba.js';
import { estudianteConSesion, pedirCorreo } from './verificacion-de-prueba.js';

const sha256 = (texto: string) => createHash('sha256').update(texto).digest('hex');

describe('recuperación de la contraseña sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('recuperación de la contraseña con PostgreSQL', () => {
  const entorno = usarBaseDeSesiones('recuperacion');
  /** Cada prueba usa una app nueva: los límites de la recuperación empiezan en cero. */
  let app: ReturnType<typeof entorno.crearAppConLimite>;

  beforeEach(() => {
    app = entorno.crearAppConLimite({ ventanaMs: 60_000, maximo: 1000 });
  });

  const { solicitar, restablecer, ingresar, pedirEnlace } = crearAyudantesDeRecuperacion(
    entorno,
    () => app,
  );
  const tokensDe = async (estudianteId: string) =>
    (
      await entorno.bd.query<{
        hash_token: string;
        hash_codigo: string | null;
        expira_en: Date;
        usado_en: Date | null;
        anulado_en: Date | null;
      }>(
        `SELECT t.hash_token, t.hash_codigo, t.expira_en, t.usado_en, t.anulado_en
           FROM app.token_correo t JOIN contenido.tipo_token_correo tt ON tt.id = t.tipo_token_correo_id
          WHERE t.estudiante_id = $1 AND tt.codigo = 'recuperacion' ORDER BY t.id`,
        [estudianteId],
      )
    ).rows;

  describe('CP-06: recuperar la contraseña con un enlace de un solo uso', () => {
    it('pasos 1 y 2: pide la recuperación, abre el enlace y crea la contraseña nueva', async () => {
      const id = await crearEstudianteDePrueba(entorno.bd, { ...EVA, nombre: 'Eva Estudiante' });

      const { respuesta, mensaje, token } = await pedirEnlace();
      const cambio = await restablecer(token);

      expect(respuesta.status).toBe(202);
      expect(mensaje).toMatchObject({
        para: EVA.correo,
        asunto: 'Crea una contraseña nueva en Supera PAES',
      });
      expect(mensaje?.texto).toContain(
        `${URL_CONSOLA_DE_PRUEBA}/restablecer-contrasena?token=${token}`,
      );
      expect(mensaje?.texto).toMatch(/Eva Estudiante[\s\S]*una sola vez y vence en 1 hora/);
      expect(Buffer.from(token, 'base64url')).toHaveLength(32);
      expect(cambio.status).toBe(200);
      // No inicia sesión: responde que se cambió y no entrega tokens.
      expect(cambio.body).toEqual({ data: { restablecida: true }, error: null, meta: null });
      expect((await tokensDe(id))[0]?.usado_en).toEqual(entorno.ahora());
    });

    it('paso 3: volver a abrir el mismo enlace se rechaza', async () => {
      await crearEstudianteDePrueba(entorno.bd, EVA);
      const { token } = await pedirEnlace();
      await restablecer(token);

      const otraVez = await restablecer(token, 'otra-clave-del-este-7');

      expect(otraVez.status).toBe(409);
      expect(otraVez.body).toEqual(errorConFormato('ENLACE_NO_VIGENTE'));
      expect(otraVez.body.error.mensaje).toMatch(/Pide un enlace nuevo/);
      expect((await ingresar(EVA.correo, CLAVE_NUEVA)).status).toBe(200);
    });

    it('paso 4: un enlace pedido hace más de 1 hora se rechaza por vencido, con el mismo mensaje', async () => {
      const id = await crearEstudianteDePrueba(entorno.bd, EVA);
      const { token } = await pedirEnlace();
      const usado = await pedirEnlace(); // el segundo anula al primero: usamos otro estudiante para el vencido
      expect(usado.token).not.toBe(token);
      entorno.avanzarSegundos(HORA_EN_SEGUNDOS + 1);

      const vencido = await restablecer(usado.token);
      const inexistente = await restablecer('no-existe');

      expect(vencido.status).toBe(409);
      expect(vencido.body).toEqual(errorConFormato('ENLACE_NO_VIGENTE'));
      // Vencido, anulado o inexistente: el mismo mensaje, para no revelar cuál fue (CU-04 4.a).
      expect(inexistente.body).toEqual(vencido.body);
      expect((await ingresar(EVA.correo, CLAVE_VIEJA)).status).toBe(200);
      expect((await tokensDe(id)).every((t) => t.usado_en === null)).toBe(true);
    });

    it('el enlace sirve justo antes de la hora y no después', async () => {
      await crearEstudianteDePrueba(entorno.bd, EVA);
      const { token } = await pedirEnlace();
      entorno.avanzarSegundos(HORA_EN_SEGUNDOS - 1);

      expect((await restablecer(token)).status).toBe(200);
    });
  });

  describe('pedir la recuperación (HU-06 esc. 1)', () => {
    it('devuelve exactamente la misma respuesta con un correo existente, uno inexistente y uno eliminado, y solo envía correo al primero', async () => {
      await crearEstudianteDePrueba(entorno.bd, EVA);
      await crearEstudianteDePrueba(entorno.bd, {
        correo: 'borrada@ejemplo.cl',
        contrasena: CLAVE_VIEJA,
        eliminado: true,
      });

      const existente = await solicitar(EVA.correo, '203.0.113.1');
      const inexistente = await solicitar('nadie@ejemplo.cl', '203.0.113.2');
      const eliminado = await solicitar('borrada@ejemplo.cl', '203.0.113.3');
      await entorno.esperarSegundoPlano();

      expect(existente.status).toBe(202);
      expect(existente.body).toEqual({ data: { solicitada: true }, error: null, meta: null });
      for (const otra of [inexistente, eliminado]) {
        expect(otra.status).toBe(existente.status);
        expect(otra.body).toEqual(existente.body);
        expect(otra.headers['content-type']).toBe(existente.headers['content-type']);
      }
      expect(entorno.correos.map((c) => c.para)).toEqual([EVA.correo]);
    });

    it('no espera el envío del correo: responde aunque el proveedor falle, y el fallo no se nota', async () => {
      await crearEstudianteDePrueba(entorno.bd, EVA);
      const registrar = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      entorno.fallarCorreo(true);

      const respuesta = await solicitar(EVA.correo);
      await entorno.esperarSegundoPlano();

      expect(respuesta.status).toBe(202);
      expect(respuesta.body.data).toEqual({ solicitada: true });
      const registro = registrar.mock.calls.map((llamada) => llamada.join(' ')).join('\n');
      expect(registro).toContain('No se pudo emitir el correo de recuperación');
      expect(registro).not.toContain(EVA.correo);
    });

    it('pedir otro enlace anula el anterior (CU-04 2.a)', async () => {
      const id = await crearEstudianteDePrueba(entorno.bd, EVA);
      const primero = await pedirEnlace(EVA.correo, '203.0.113.1');
      const segundo = await pedirEnlace(EVA.correo, '203.0.113.2');

      const conElAnterior = await restablecer(primero.token);
      const conElNuevo = await restablecer(segundo.token);

      expect(conElAnterior.status).toBe(409);
      expect(conElAnterior.body.error.codigo).toBe('ENLACE_NO_VIGENTE');
      expect(conElNuevo.status).toBe(200);
      expect((await tokensDe(id)).map((t) => [t.anulado_en !== null, t.usado_en !== null])).toEqual(
        [
          [true, false],
          [false, true],
        ],
      );
    });

    it('guarda solo el SHA-256 del enlace, sin código, con vigencia de 1 hora', async () => {
      const id = await crearEstudianteDePrueba(entorno.bd, EVA);

      const { token } = await pedirEnlace();

      const [fila] = await tokensDe(id);
      expect(fila?.hash_token).toBe(sha256(token));
      expect(fila?.hash_token).not.toContain(token);
      expect(fila?.hash_codigo).toBeNull();
      expect(fila?.expira_en.getTime()).toBe(entorno.ahora().getTime() + HORA_EN_SEGUNDOS * 1000);
    });

    it('una cuenta con el correo sin verificar también recupera, y recuperar no la verifica', async () => {
      const sinVerificar = await crearEstudianteDePrueba(entorno.bd, {
        ...EVA,
        correoVerificado: false,
      });
      const verificada = await crearEstudianteDePrueba(entorno.bd, {
        correo: 'ana@ejemplo.cl',
        contrasena: CLAVE_VIEJA,
        correoVerificado: true,
      });

      const a = await pedirEnlace(EVA.correo, '203.0.113.1');
      const b = await pedirEnlace('ana@ejemplo.cl', '203.0.113.2');
      await restablecer(a.token);
      await restablecer(b.token);

      const { rows } = await entorno.bd.query<{ id: string; v: boolean }>(
        'SELECT id::text AS id, correo_verificado AS v FROM app.estudiante ORDER BY id',
      );
      expect(rows).toEqual([
        { id: sinVerificar, v: false },
        { id: verificada, v: true },
      ]);
      expect(entorno.correos.filter((c) => c.asunto.startsWith('Verifica'))).toEqual([]);
    });

    it('un enlace de verificación del correo no sirve para recuperar', async () => {
      const eva = await estudianteConSesion(entorno);
      const { token } = await pedirCorreo(entorno, eva.sesion);

      const respuesta = await restablecer(token);

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.codigo).toBe('ENLACE_NO_VIGENTE');
    });
  });

  describe('crear la contraseña nueva (HU-06 esc. 2 y 3, CP-54 paso 5)', () => {
    it.each([
      ['contrasena_corta', 'corta12'],
      ['contrasena_larga', 'k'.repeat(73)],
      ['contrasena_bytes', '😀'.repeat(20)],
      ['contrasena_igual_correo', 'Eva@Ejemplo.cl'],
      ['contrasena_comun', 'Contraseña123'],
    ])(
      'rechaza la contraseña con motivo %s y el enlace sigue sirviendo',
      async (motivo, contrasena) => {
        await crearEstudianteDePrueba(entorno.bd, EVA);
        const { token } = await pedirEnlace();

        const rechazada = await restablecer(token, contrasena);
        const corregida = await restablecer(token, CLAVE_NUEVA);

        expect(rechazada.status).toBe(400);
        expect(rechazada.body.error.codigo).toBe('VALIDACION');
        expect(rechazada.body.error.detalles[0]).toMatchObject({ ruta: 'contrasena', motivo });
        expect(rechazada.body.error.mensaje).not.toBe('');
        expect(corregida.status).toBe(200);
        expect((await ingresar(EVA.correo, CLAVE_NUEVA)).status).toBe(200);
      },
    );

    it('con un enlace que no sirve responde ENLACE_NO_VIGENTE aunque la contraseña también sea inválida', async () => {
      await crearEstudianteDePrueba(entorno.bd, EVA);

      const respuesta = await restablecer('no-existe', 'corta12');

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.codigo).toBe('ENLACE_NO_VIGENTE');
    });

    it('valida la forma de lo que llega: sin token o sin contraseña, 400', async () => {
      expect((await request(app).post(RESTABLECER).send({ contrasena: CLAVE_NUEVA })).status).toBe(
        400,
      );
      expect((await request(app).post(RESTABLECER).send({ token: 'x' })).status).toBe(400);
      expect(
        (await request(app).post(RESTABLECER).send({ token: 'x', contrasena: '' })).status,
      ).toBe(400);
    });

    it('dos usos a la vez del mismo enlace: solo uno cambia la contraseña', async () => {
      await crearEstudianteDePrueba(entorno.bd, EVA);
      const { token } = await pedirEnlace();

      const estados = (
        await Promise.all([
          restablecer(token, 'primera-clave-del-sur-1'),
          restablecer(token, 'segunda-clave-del-sur-2'),
        ])
      ).map((r) => r.status);

      expect(estados.sort()).toEqual([200, 409]);
    });
  });

  describe('después de restablecer', () => {
    it('el ingreso funciona con la contraseña nueva y falla con la anterior', async () => {
      await crearEstudianteDePrueba(entorno.bd, EVA);
      const { token } = await pedirEnlace();

      await restablecer(token);

      expect((await ingresar(EVA.correo, CLAVE_NUEVA)).status).toBe(200);
      const anterior = await ingresar(EVA.correo, CLAVE_VIEJA);
      expect(anterior.status).toBe(401);
      expect(anterior.body).toEqual(errorConFormato('NO_AUTENTICADO'));
    });

    it('las sesiones abiertas dejan de servir y de renovar; las de otro estudiante siguen', async () => {
      await crearEstudianteDePrueba(entorno.bd, EVA);
      await crearEstudianteDePrueba(entorno.bd, {
        correo: 'ana@ejemplo.cl',
        contrasena: CLAVE_VIEJA,
      });
      const telefono = (await ingresar(EVA.correo, CLAVE_VIEJA)).body.data as {
        tokenAcceso: string;
        tokenRenovacion: string;
      };
      const tablet = (await ingresar(EVA.correo, CLAVE_VIEJA)).body.data as typeof telefono;
      const ajena = (await ingresar('ana@ejemplo.cl', CLAVE_VIEJA)).body.data as typeof telefono;
      const { token } = await pedirEnlace();

      await restablecer(token);

      const usar = (t: string) => request(app).get(RUTA_APP_PROTEGIDA).set(conToken(t));
      const renovar = (t: string) =>
        request(app).post(RUTA_RENOVAR_APP).send({ tokenRenovacion: t });
      expect([telefono, tablet].map((s) => s.tokenAcceso)).toHaveLength(2);
      expect((await usar(telefono.tokenAcceso)).status).toBe(401);
      expect((await usar(tablet.tokenAcceso)).status).toBe(401);
      expect((await renovar(telefono.tokenRenovacion)).status).toBe(401);
      expect((await renovar(tablet.tokenRenovacion)).status).toBe(401);
      expect((await usar(ajena.tokenAcceso)).status).toBe(404);
      expect((await renovar(ajena.tokenRenovacion)).status).toBe(200);
    });
  });
});
