// Cambio de la contraseña asignada por el administrador (correcciones de seguridad, etapa 4), sin base
// real: la marca al crear y editar una cuenta, el ingreso y /yo que la informan, el bloqueo 403 de la
// consola mientras está pendiente, el cambio con la contraseña actual (RN-31), el cierre de las demás
// sesiones y el límite de intentos fallidos por cuenta. Las consultas reales están en
// usuarios-internos-bd.test.ts.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { compararContrasena } from '../comun/contrasenas.js';
import { errorConFormato, tokenAdmin } from './ayudantes.js';
import {
  ADMIN,
  conToken,
  crearEscenarioSesiones,
  DOCENTE,
  RUTA_CONTRASENA,
  RUTA_RENOVAR,
  RUTA_USUARIOS,
  RUTA_YO,
  sesionDe,
} from './escenario-sesiones.js';
import { comoAdmin, crearEscenario, docente, RUTA } from './escenario-usuarios-internos.js';

const NUEVA = 'mi-clave-propia-2026';
/**
 * Cada prueba cifra y compara varias contraseñas con bcrypt (costo 12): con toda la suite en paralelo
 * puede pasar los 5 s por defecto.
 */
const BCRYPT_MS = 20_000;

/** Un administrador y un docente cuya contraseña asignó un administrador. */
async function conCambioPendiente() {
  const escenario = crearEscenarioSesiones();
  const adminId = await escenario.crearCuenta({ ...ADMIN, debeCambiarContrasena: true });
  const docenteId = await escenario.crearCuenta({ ...DOCENTE, debeCambiarContrasena: true });
  return { ...escenario, adminId, docenteId };
}

const cambiar = (
  escenario: Awaited<ReturnType<typeof conCambioPendiente>>,
  token: string,
  cuerpo: Record<string, unknown>,
) => request(escenario.app).post(RUTA_CONTRASENA).set(conToken(token)).send(cuerpo);

describe(
  'la marca de cambio pendiente al crear y editar una cuenta interna',
  { timeout: BCRYPT_MS },
  () => {
    it('crear una cuenta desde la consola deja la marca puesta', async () => {
      const { app, usuarios } = crearEscenario();

      const respuesta = await request(app)
        .post(RUTA)
        .set(await comoAdmin())
        .send(docente());

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.data).toMatchObject({ debeCambiarContrasena: true });
      expect(usuarios.get('1')?.debeCambiarContrasena).toBe(true);
    });

    it('cuando el administrador le cambia la contraseña a otra cuenta, la marca vuelve', async () => {
      const { app, usuarios } = crearEscenario();
      await request(app)
        .post(RUTA)
        .set(await comoAdmin())
        .send(docente());
      const cuenta = usuarios.get('1');
      if (cuenta) cuenta.debeCambiarContrasena = false;

      const sinContrasena = await request(app)
        .patch(`${RUTA}/1`)
        .set(await comoAdmin())
        .send({ nombre: 'Diego D.' });
      expect(sinContrasena.body.data).toMatchObject({ debeCambiarContrasena: false });

      const conContrasena = await request(app)
        .patch(`${RUTA}/1`)
        .set(await comoAdmin())
        .send({ contrasena: 'clave-nueva-10' });
      expect(conContrasena.status).toBe(200);
      expect(conContrasena.body.data).toMatchObject({ debeCambiarContrasena: true });
      expect(usuarios.get('1')?.debeCambiarContrasena).toBe(true);
    });

    it('la contraseña que un administrador se pone a sí mismo no deja la marca', async () => {
      const { app, usuarios } = crearEscenario();
      await request(app)
        .post(RUTA)
        .set(await comoAdmin())
        .send(docente({ rol: 'admin', areas: [], correo: 'otro@ejemplo.cl' }));
      const propia = { Authorization: `Bearer ${await tokenAdmin('admin', '1')}` };

      const respuesta = await request(app)
        .patch(`${RUTA}/1`)
        .set(propia)
        .send({ contrasena: 'clave-elegida-11' });

      expect(respuesta.status).toBe(200);
      expect(usuarios.get('1')?.debeCambiarContrasena).toBe(false);
    });
  },
);

describe('el ingreso y /yo informan el cambio pendiente', { timeout: BCRYPT_MS }, () => {
  it('el ingreso y /yo devuelven debeCambiarContrasena', async () => {
    const escenario = await conCambioPendiente();

    const ingreso = await escenario.ingresar(ADMIN.correo, ADMIN.contrasena);
    expect(ingreso.status).toBe(200);
    expect(ingreso.body.data.usuario).toMatchObject({ debeCambiarContrasena: true });

    const yo = await request(escenario.app)
      .get(RUTA_YO)
      .set(conToken(ingreso.body.data.tokenAcceso as string));
    expect(yo.status).toBe(200);
    expect(yo.body.data).toMatchObject({ rol: 'admin', debeCambiarContrasena: true });
  });
});

describe('bloqueo de la consola mientras el cambio está pendiente', { timeout: BCRYPT_MS }, () => {
  it('toda ruta de /admin responde 403 CAMBIO_CONTRASENA_PENDIENTE salvo yo, contraseña, renovar y cerrar', async () => {
    const escenario = await conCambioPendiente();
    const { tokenAcceso, tokenRenovacion } = await sesionDe(escenario, ADMIN);
    const conSesion = conToken(tokenAcceso);

    const usuarios = await request(escenario.app).get(RUTA_USUARIOS).set(conSesion);
    expect(usuarios.status).toBe(403);
    expect(usuarios.body).toEqual(errorConFormato('CAMBIO_CONTRASENA_PENDIENTE'));
    expect(usuarios.body.error.mensaje).toMatch(/cambiar la contraseña/);
    // También las rutas de cuentas que no sirven para el cambio.
    const estudiantes = await request(escenario.app)
      .get('/api/v1/admin/cuentas/estudiantes')
      .set(conSesion);
    expect(estudiantes.status).toBe(403);
    expect(estudiantes.body.error.codigo).toBe('CAMBIO_CONTRASENA_PENDIENTE');

    expect((await request(escenario.app).get(RUTA_YO).set(conSesion)).status).toBe(200);
    const renovada = await request(escenario.app).post(RUTA_RENOVAR).send({ tokenRenovacion });
    expect(renovada.status).toBe(200);
  });

  it('el docente también queda bloqueado', async () => {
    const escenario = await conCambioPendiente();
    const { tokenAcceso } = await sesionDe(escenario, DOCENTE);

    const respuesta = await request(escenario.app)
      .get('/api/v1/admin/revision/mis-revisiones')
      .set(conToken(tokenAcceso));

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.codigo).toBe('CAMBIO_CONTRASENA_PENDIENTE');
  });

  it('después del cambio la consola responde con normalidad, con el mismo token', async () => {
    const escenario = await conCambioPendiente();
    const { tokenAcceso } = await sesionDe(escenario, ADMIN);

    const cambio = await cambiar(escenario, tokenAcceso, {
      actual: ADMIN.contrasena,
      nueva: NUEVA,
    });
    expect(cambio.status).toBe(200);

    const usuarios = await request(escenario.app).get(RUTA_USUARIOS).set(conToken(tokenAcceso));
    expect(usuarios.status).toBe(200);
    const yo = await request(escenario.app).get(RUTA_YO).set(conToken(tokenAcceso));
    expect(yo.body.data).toMatchObject({ debeCambiarContrasena: false });
  });
});

describe('POST /admin/cuentas/contrasena', { timeout: BCRYPT_MS }, () => {
  it('con la contraseña actual correcta guarda la nueva, quita la marca y lo audita sin el hash', async () => {
    const escenario = await conCambioPendiente();
    const { tokenAcceso } = await sesionDe(escenario, ADMIN);

    const respuesta = await cambiar(escenario, tokenAcceso, {
      actual: ADMIN.contrasena,
      nueva: NUEVA,
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ data: { contrasenaCambiada: true }, error: null, meta: null });
    const cuenta = escenario.usuarios.get(escenario.adminId);
    expect(cuenta?.debeCambiarContrasena).toBe(false);
    expect(await compararContrasena(NUEVA, cuenta?.hash ?? '')).toBe(true);
    expect(escenario.auditoria).toEqual([
      {
        usuarioId: escenario.adminId,
        accion: 'cambiar_contrasena',
        entidad: 'usuario_interno',
        entidadId: escenario.adminId,
        antes: null,
        despues: { contrasena_cambiada: true },
      },
    ]);
    expect(JSON.stringify(escenario.auditoria)).not.toMatch(/\$2[aby]\$|mi-clave|clave-de-ana/);
    // La contraseña anterior ya no sirve para entrar; la nueva sí.
    expect((await escenario.ingresar(ADMIN.correo, ADMIN.contrasena)).status).toBe(401);
    const ingreso = await escenario.ingresar(ADMIN.correo, NUEVA);
    expect(ingreso.body.data.usuario).toMatchObject({ debeCambiarContrasena: false });
  });

  it('una cuenta sin cambio pendiente también puede cambiarla cuando quiera', async () => {
    const escenario = crearEscenarioSesiones();
    await escenario.crearCuenta(DOCENTE);
    const { tokenAcceso } = await sesionDe(escenario, DOCENTE);

    const respuesta = await request(escenario.app)
      .post(RUTA_CONTRASENA)
      .set(conToken(tokenAcceso))
      .send({ actual: DOCENTE.contrasena, nueva: NUEVA });

    expect(respuesta.status).toBe(200);
  });

  it('con la contraseña actual incorrecta responde 401 y no cambia nada', async () => {
    const escenario = await conCambioPendiente();
    const { tokenAcceso } = await sesionDe(escenario, ADMIN);

    const respuesta = await cambiar(escenario, tokenAcceso, {
      actual: 'no-es-la-actual',
      nueva: NUEVA,
    });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual(errorConFormato('NO_AUTENTICADO'));
    expect(respuesta.body.error.mensaje).toBe('La contraseña actual no es correcta.');
    expect(escenario.usuarios.get(escenario.adminId)?.debeCambiarContrasena).toBe(true);
    expect(escenario.auditoria).toHaveLength(0);
    // La sesión sigue abierta: el 401 es de la contraseña, no de la sesión.
    expect((await request(escenario.app).get(RUTA_YO).set(conToken(tokenAcceso))).status).toBe(200);
  });

  it.each([
    ['de 7 caracteres', 'corta12', 'contrasena_corta'],
    ['igual al correo', ADMIN.correo, 'contrasena_igual_correo'],
    ['común (HU-01.4)', 'Contraseña123', 'contrasena_comun'],
    ['igual a la actual', ADMIN.contrasena, 'contrasena_igual_actual'],
  ])('rechaza una contraseña nueva %s con 400 (RN-31)', async (_caso, nueva, motivo) => {
    const escenario = await conCambioPendiente();
    const { tokenAcceso } = await sesionDe(escenario, ADMIN);

    const respuesta = await cambiar(escenario, tokenAcceso, { actual: ADMIN.contrasena, nueva });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
    expect(respuesta.body.error.detalles[0]).toMatchObject({ ruta: 'nueva', motivo });
    expect(escenario.usuarios.get(escenario.adminId)?.debeCambiarContrasena).toBe(true);
  });

  it('rechaza un cuerpo con campos de más o sin la contraseña actual', async () => {
    const escenario = await conCambioPendiente();
    const { tokenAcceso } = await sesionDe(escenario, ADMIN);

    const deMas = await cambiar(escenario, tokenAcceso, {
      actual: ADMIN.contrasena,
      nueva: NUEVA,
      correo: 'otra@ejemplo.cl',
    });
    const sinActual = await cambiar(escenario, tokenAcceso, { nueva: NUEVA });

    expect(deMas.status).toBe(400);
    expect(sinActual.status).toBe(400);
  });

  it('sin token responde 401', async () => {
    const escenario = await conCambioPendiente();

    const respuesta = await request(escenario.app)
      .post(RUTA_CONTRASENA)
      .send({ actual: ADMIN.contrasena, nueva: NUEVA });

    expect(respuesta.status).toBe(401);
  });

  it('cierra las demás sesiones de la cuenta y deja abierta la de la petición', async () => {
    const escenario = await conCambioPendiente();
    const actual = await sesionDe(escenario, ADMIN);
    const otra = await sesionDe(escenario, ADMIN);
    const delDocente = await sesionDe(escenario, DOCENTE);

    const respuesta = await cambiar(escenario, actual.tokenAcceso, {
      actual: ADMIN.contrasena,
      nueva: NUEVA,
    });
    expect(respuesta.status).toBe(200);

    const yo = (token: string) => request(escenario.app).get(RUTA_YO).set(conToken(token));
    const renovar = (token: string) =>
      request(escenario.app).post(RUTA_RENOVAR).send({ tokenRenovacion: token });
    expect((await yo(otra.tokenAcceso)).status).toBe(401);
    expect((await renovar(otra.tokenRenovacion)).status).toBe(401);
    expect((await yo(actual.tokenAcceso)).status).toBe(200);
    expect((await renovar(actual.tokenRenovacion)).status).toBe(200);
    // Las sesiones de otras cuentas no cambian.
    expect((await yo(delDocente.tokenAcceso)).status).toBe(200);
  });

  it('limita a 5 los intentos fallidos por cuenta cada 15 minutos', async () => {
    const escenario = await conCambioPendiente();
    const delAdmin = await sesionDe(escenario, ADMIN);
    const delDocente = await sesionDe(escenario, DOCENTE);
    const fallido = { actual: 'no-es-la-actual', nueva: NUEVA };

    for (let intento = 0; intento < 5; intento += 1) {
      expect((await cambiar(escenario, delAdmin.tokenAcceso, fallido)).status).toBe(401);
    }
    const sexto = await cambiar(escenario, delAdmin.tokenAcceso, {
      actual: ADMIN.contrasena,
      nueva: NUEVA,
    });

    expect(sexto.status).toBe(429);
    expect(sexto.body).toEqual(errorConFormato('DEMASIADOS_INTENTOS'));
    // El límite es de la cuenta: otra cuenta desde la misma IP sigue pudiendo cambiarla.
    const otraCuenta = await cambiar(escenario, delDocente.tokenAcceso, {
      actual: DOCENTE.contrasena,
      nueva: NUEVA,
    });
    expect(otraCuenta.status).toBe(200);
    // Esta prueba hace siete comparaciones seguidas con bcrypt.
  }, 40_000);
});
