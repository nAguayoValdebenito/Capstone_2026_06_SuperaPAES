// Sesión de la consola, sin base real (HU-02.1 consola, HU-02.3, RNF-01, CP-04 paso 4, CU-23 3.b):
// renovar con rotación, cerrar con el token de renovación, vencimiento con el reloj adelantado y
// cierre de las sesiones al desactivar la cuenta. Las mismas reglas contra PostgreSQL están en
// sesion-consola-bd.test.ts.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  DURACION_TOKEN_ACCESO_SEGUNDOS,
  DURACION_TOKEN_RENOVACION_SEGUNDOS,
} from '../modulos/cuentas/cuentas.servicio.js';
import { errorConFormato } from './ayudantes.js';
import {
  conCuentas,
  conToken,
  DOCENTE,
  RUTA_CERRAR,
  RUTA_RENOVAR,
  RUTA_USUARIOS,
  RUTA_YO,
  sesionDe,
} from './escenario-sesiones.js';

describe('renovar la sesión', () => {
  it('entrega tokens nuevos; el token de renovación usado ya no renueva', async () => {
    const escenario = await conCuentas();
    const primera = await sesionDe(escenario);

    const renovada = await request(escenario.app)
      .post(RUTA_RENOVAR)
      .send({ tokenRenovacion: primera.tokenRenovacion });
    const otraVez = await request(escenario.app)
      .post(RUTA_RENOVAR)
      .send({ tokenRenovacion: primera.tokenRenovacion });

    expect(renovada.status).toBe(200);
    expect(renovada.body.data.tokenRenovacion).not.toBe(primera.tokenRenovacion);
    expect(renovada.body.data.tokenAcceso).not.toBe(primera.tokenAcceso);
    expect(otraVez.status).toBe(401);
    expect(otraVez.body).toEqual(errorConFormato('NO_AUTENTICADO'));
    const nuevo = await request(escenario.app)
      .get(RUTA_YO)
      .set(conToken(renovada.body.data.tokenAcceso as string));
    expect(nuevo.status).toBe(200);
  });

  it('el token de acceso de la sesión rotada deja de servir', async () => {
    const escenario = await conCuentas();
    const primera = await sesionDe(escenario);

    await request(escenario.app)
      .post(RUTA_RENOVAR)
      .send({ tokenRenovacion: primera.tokenRenovacion });

    const viejo = await request(escenario.app).get(RUTA_YO).set(conToken(primera.tokenAcceso));
    expect(viejo.status).toBe(401);
  });

  it('un token inventado responde 401 y un cuerpo sin token, 400', async () => {
    const escenario = await conCuentas();

    const inventado = await request(escenario.app)
      .post(RUTA_RENOVAR)
      .send({ tokenRenovacion: 'no-existe' });
    const sinToken = await request(escenario.app).post(RUTA_RENOVAR).send({});

    expect(inventado.status).toBe(401);
    expect(sinToken.status).toBe(400);
  });

  it('un cambio de rol invalida el token de acceso y rige desde la renovación', async () => {
    const escenario = await conCuentas();
    const admin = await sesionDe(escenario);
    const docente = await sesionDe(escenario, DOCENTE);

    await request(escenario.app)
      .patch(`${RUTA_USUARIOS}/${escenario.docenteId}`)
      .set(conToken(admin.tokenAcceso))
      .send({ rol: 'admin' });

    const conRolViejo = await request(escenario.app)
      .get(RUTA_YO)
      .set(conToken(docente.tokenAcceso));
    const renovada = await request(escenario.app)
      .post(RUTA_RENOVAR)
      .send({ tokenRenovacion: docente.tokenRenovacion });
    const conRolNuevo = await request(escenario.app)
      .get(RUTA_YO)
      .set(conToken(renovada.body.data.tokenAcceso as string));

    expect(conRolViejo.status).toBe(401);
    expect(renovada.status).toBe(200);
    expect(conRolNuevo.body.data.rol).toBe('admin');
  });
});

describe('cerrar la sesión (CP-04 paso 4)', () => {
  it('después de cerrar no se puede renovar y el token de acceso de esa sesión deja de servir', async () => {
    const escenario = await conCuentas();
    const sesion = await sesionDe(escenario);

    const cierre = await request(escenario.app)
      .post(RUTA_CERRAR)
      .send({ tokenRenovacion: sesion.tokenRenovacion });
    const renovar = await request(escenario.app)
      .post(RUTA_RENOVAR)
      .send({ tokenRenovacion: sesion.tokenRenovacion });
    const yo = await request(escenario.app).get(RUTA_YO).set(conToken(sesion.tokenAcceso));

    expect(cierre.status).toBe(200);
    expect(cierre.body).toEqual({ data: { sesionCerrada: true }, error: null, meta: null });
    expect(renovar.status).toBe(401);
    expect(yo.status).toBe(401);
  });

  it('responde igual si la sesión ya estaba cerrada o el token no existe', async () => {
    const escenario = await conCuentas();
    const { tokenRenovacion } = await sesionDe(escenario);

    const primera = await request(escenario.app).post(RUTA_CERRAR).send({ tokenRenovacion });
    const segunda = await request(escenario.app).post(RUTA_CERRAR).send({ tokenRenovacion });
    const inventado = await request(escenario.app)
      .post(RUTA_CERRAR)
      .send({ tokenRenovacion: 'no-existe' });

    expect(segunda.status).toBe(200);
    expect(segunda.body).toEqual(primera.body);
    expect(inventado.body).toEqual(primera.body);
  });

  it('funciona aunque el token de acceso ya haya vencido', async () => {
    const escenario = await conCuentas();
    const { tokenRenovacion } = await sesionDe(escenario);
    escenario.avanzarSegundos(DURACION_TOKEN_ACCESO_SEGUNDOS + 60);

    await request(escenario.app).post(RUTA_CERRAR).send({ tokenRenovacion });

    const renovar = await request(escenario.app).post(RUTA_RENOVAR).send({ tokenRenovacion });
    expect(renovar.status).toBe(401);
  });

  it('cerrar una sesión no cierra las otras sesiones de la misma cuenta', async () => {
    const escenario = await conCuentas();
    const enUnEquipo = await sesionDe(escenario);
    const enOtro = await sesionDe(escenario);

    await request(escenario.app)
      .post(RUTA_CERRAR)
      .send({ tokenRenovacion: enUnEquipo.tokenRenovacion });

    const yo = await request(escenario.app).get(RUTA_YO).set(conToken(enOtro.tokenAcceso));
    expect(yo.status).toBe(200);
  });
});

describe('vencimiento de la sesión (reloj adelantado)', () => {
  it('el token de acceso vence a los 15 minutos; la renovación sigue sirviendo', async () => {
    const escenario = await conCuentas();
    const sesion = await sesionDe(escenario);
    const yo = () => request(escenario.app).get(RUTA_YO).set(conToken(sesion.tokenAcceso));

    escenario.avanzarSegundos(DURACION_TOKEN_ACCESO_SEGUNDOS - 1);
    const antes = await yo();
    escenario.avanzarSegundos(2);
    const despues = await yo();
    const renovada = await request(escenario.app)
      .post(RUTA_RENOVAR)
      .send({ tokenRenovacion: sesion.tokenRenovacion });

    expect(antes.status).toBe(200);
    expect(despues.status).toBe(401);
    expect(renovada.status).toBe(200);
  });

  it('la renovación de la consola vence a las 8 horas desde la última renovación', async () => {
    const escenario = await conCuentas();
    let { tokenRenovacion } = await sesionDe(escenario);
    const renovar = () => request(escenario.app).post(RUTA_RENOVAR).send({ tokenRenovacion });
    const ochoHoras = DURACION_TOKEN_RENOVACION_SEGUNDOS.admin;

    escenario.avanzarSegundos(ochoHoras - 60);
    const conActividad = await renovar();
    tokenRenovacion = conActividad.body.data.tokenRenovacion as string;
    escenario.avanzarSegundos(ochoHoras - 60);
    const otraVez = await renovar();
    tokenRenovacion = otraVez.body.data.tokenRenovacion as string;
    escenario.avanzarSegundos(ochoHoras + 1);
    const sinActividad = await renovar();

    expect(conActividad.status).toBe(200);
    expect(otraVez.status).toBe(200);
    expect(sinActividad.status).toBe(401);
  });
});

describe('desactivar una cuenta cierra sus sesiones (CU-23 3.b)', () => {
  it('el docente desactivado pierde el acceso y la renovación, y al activarlo vuelve a ingresar', async () => {
    const escenario = await conCuentas();
    const admin = await sesionDe(escenario);
    const docente = await sesionDe(escenario, DOCENTE);
    const comoAdmin = conToken(admin.tokenAcceso);
    const rutaDocente = `${RUTA_USUARIOS}/${escenario.docenteId}`;

    await request(escenario.app).post(`${rutaDocente}/desactivar`).set(comoAdmin);
    const acceso = await request(escenario.app).get(RUTA_YO).set(conToken(docente.tokenAcceso));
    await request(escenario.app).post(`${rutaDocente}/activar`).set(comoAdmin);
    const renovar = await request(escenario.app)
      .post(RUTA_RENOVAR)
      .send({ tokenRenovacion: docente.tokenRenovacion });
    const nuevoIngreso = await escenario.ingresar(DOCENTE.correo, DOCENTE.contrasena);

    expect(acceso.status).toBe(401);
    // Activar la cuenta no revive la sesión cerrada.
    expect(renovar.status).toBe(401);
    expect(nuevoIngreso.status).toBe(200);
    const delDocente = [...escenario.sesiones.values()].filter(
      (fila) => fila.cuentaId === escenario.docenteId,
    );
    expect(delDocente.map((fila) => fila.revocadoEn !== null)).toEqual([true, false]);
  });
});
