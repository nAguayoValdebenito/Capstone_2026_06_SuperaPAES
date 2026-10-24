// Sesión de la consola contra PostgreSQL real (ver base-temporal.ts), con el pool y la unidad de
// trabajo de la API: app.token_sesion guarda solo el SHA-256 del token, renovar rota la fila (también
// con dos renovaciones a la vez), cerrar la revoca, desactivar una cuenta cierra sus sesiones
// (CU-23 3.b), una cuenta desactivada no recibe sesión y un estudiante no entra a la consola (CP-04).
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cifrarContrasena } from '../comun/contrasenas.js';
import { crearPrimerAdministrador } from '../db/primer-administrador.js';
import { DURACION_TOKEN_RENOVACION_SEGUNDOS } from '../modulos/cuentas/cuentas.servicio.js';
import { usarBaseDeSesiones } from './base-sesiones.js';
import { exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';
import {
  conToken,
  RUTA_CERRAR,
  RUTA_INGRESO,
  RUTA_RENOVAR,
  RUTA_YO,
  sha256,
} from './escenario-sesiones.js';

const ADMIN = { nombre: 'Ana Admin', correo: 'ana@ejemplo.cl', contrasena: 'clave-de-ana-1' };
const DOCENTE = { correo: 'diego@ejemplo.cl', contrasena: 'clave-de-diego-1' };

interface FilaSesion {
  usuario_interno_id: string | null;
  estudiante_id: string | null;
  hash_token: string;
  expira_en: Date;
  revocado_en: Date | null;
}

describe('sesión de la consola sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('sesión de la consola con PostgreSQL', () => {
  const entorno = usarBaseDeSesiones('sesiones');
  let adminId: string;
  let docenteId: string;
  let areaId: number | undefined;

  const sesionesDe = async (usuarioId: string) =>
    (
      await entorno.bd.query<FilaSesion>(
        `SELECT usuario_interno_id::text, estudiante_id::text, hash_token, expira_en, revocado_en
           FROM app.token_sesion WHERE usuario_interno_id = $1 ORDER BY id`,
        [usuarioId],
      )
    ).rows;

  const ingresar = (correo: string, contrasena: string) =>
    request(entorno.app).post(RUTA_INGRESO).send({ correo, contrasena });

  beforeAll(async () => {
    const { rows } = await entorno.bd.query<{ id: number }>(
      `INSERT INTO contenido.area (nombre) VALUES ('Área de prueba') RETURNING id`,
    );
    areaId = rows[0]?.id;
  });

  beforeEach(async () => {
    adminId = (await crearPrimerAdministrador(entorno.bd, ADMIN)).id;
    const admin = await ingresar(ADMIN.correo, ADMIN.contrasena);
    const docente = await request(entorno.app)
      .post('/api/v1/admin/administracion/usuarios-internos')
      .set(conToken(admin.body.data.tokenAcceso as string))
      .send({ nombre: 'Diego Docente', ...DOCENTE, rol: 'docente', areas: [areaId] });
    docenteId = docente.body.data.id as string;
  }, MINUTO);

  it('el ingreso guarda solo el SHA-256 del token, vence a las 8 horas y registra el acceso', async () => {
    const respuesta = await ingresar(DOCENTE.correo, DOCENTE.contrasena);

    const [fila] = await sesionesDe(docenteId);
    const { rows } = await entorno.bd.query<{ ultimo_acceso: Date }>(
      'SELECT ultimo_acceso FROM contenido.usuario_interno WHERE id = $1',
      [docenteId],
    );
    expect(respuesta.status).toBe(200);
    expect(fila?.hash_token).toBe(sha256(respuesta.body.data.tokenRenovacion as string));
    expect(fila).toMatchObject({ estudiante_id: null, revocado_en: null });
    expect(fila?.expira_en.getTime()).toBe(
      entorno.ahora().getTime() + DURACION_TOKEN_RENOVACION_SEGUNDOS.admin * 1000,
    );
    expect(rows[0]?.ultimo_acceso).toEqual(entorno.ahora());
    const yo = await request(entorno.app)
      .get(RUTA_YO)
      .set(conToken(respuesta.body.data.tokenAcceso as string));
    expect(yo.body.data).toMatchObject({
      id: docenteId,
      rol: 'docente',
      areas: [expect.any(Number)],
    });
  });

  it('renovar revoca la fila usada y crea otra; el token anterior ya no renueva ni da acceso', async () => {
    const { body } = await ingresar(DOCENTE.correo, DOCENTE.contrasena);
    const { tokenAcceso, tokenRenovacion } = body.data as Record<string, string>;

    const renovada = await request(entorno.app).post(RUTA_RENOVAR).send({ tokenRenovacion });
    const otraVez = await request(entorno.app).post(RUTA_RENOVAR).send({ tokenRenovacion });
    const accesoViejo = await request(entorno.app)
      .get(RUTA_YO)
      .set(conToken(tokenAcceso ?? ''));

    const filas = await sesionesDe(docenteId);
    expect(renovada.status).toBe(200);
    expect(otraVez.status).toBe(401);
    expect(accesoViejo.status).toBe(401);
    expect(filas.map((f) => f.revocado_en !== null)).toEqual([true, false]);
    expect(filas[1]?.hash_token).toBe(sha256(renovada.body.data.tokenRenovacion as string));
  });

  it('dos renovaciones a la vez con el mismo token: solo una tiene éxito', async () => {
    const { body } = await ingresar(DOCENTE.correo, DOCENTE.contrasena);
    const cuerpo = { tokenRenovacion: body.data.tokenRenovacion as string };

    const estados = (
      await Promise.all([
        request(entorno.app).post(RUTA_RENOVAR).send(cuerpo),
        request(entorno.app).post(RUTA_RENOVAR).send(cuerpo),
      ])
    ).map((r) => r.status);

    expect(estados.sort()).toEqual([200, 401]);
    expect((await sesionesDe(docenteId)).filter((f) => f.revocado_en === null)).toHaveLength(1);
  });

  it('cerrar revoca la fila: el acceso y la renovación dejan de servir, y repetirlo responde igual', async () => {
    const { body } = await ingresar(DOCENTE.correo, DOCENTE.contrasena);
    const { tokenAcceso, tokenRenovacion } = body.data as Record<string, string>;

    const cierre = await request(entorno.app).post(RUTA_CERRAR).send({ tokenRenovacion });
    const repetido = await request(entorno.app).post(RUTA_CERRAR).send({ tokenRenovacion });
    const acceso = await request(entorno.app)
      .get(RUTA_YO)
      .set(conToken(tokenAcceso ?? ''));
    const renovar = await request(entorno.app).post(RUTA_RENOVAR).send({ tokenRenovacion });

    const [fila] = await sesionesDe(docenteId);
    expect(cierre.status).toBe(200);
    expect(repetido.body).toEqual(cierre.body);
    expect(fila?.revocado_en).toEqual(entorno.ahora());
    expect(acceso.status).toBe(401);
    expect(renovar.status).toBe(401);
  });

  it('la renovación vencida se rechaza (reloj adelantado 8 horas)', async () => {
    const { body } = await ingresar(DOCENTE.correo, DOCENTE.contrasena);
    entorno.avanzarSegundos(DURACION_TOKEN_RENOVACION_SEGUNDOS.admin);

    const renovar = await request(entorno.app)
      .post(RUTA_RENOVAR)
      .send({ tokenRenovacion: body.data.tokenRenovacion as string });

    expect(renovar.status).toBe(401);
  });

  it('desactivar al docente cierra todas sus sesiones en la misma transacción (CU-23 3.b)', async () => {
    const admin = await ingresar(ADMIN.correo, ADMIN.contrasena);
    const enUnEquipo = await ingresar(DOCENTE.correo, DOCENTE.contrasena);
    await ingresar(DOCENTE.correo, DOCENTE.contrasena);

    const desactivar = await request(entorno.app)
      .post(`/api/v1/admin/administracion/usuarios-internos/${docenteId}/desactivar`)
      .set(conToken(admin.body.data.tokenAcceso as string));
    const acceso = await request(entorno.app)
      .get(RUTA_YO)
      .set(conToken(enUnEquipo.body.data.tokenAcceso as string));

    expect(desactivar.status).toBe(200);
    expect((await sesionesDe(docenteId)).map((f) => f.revocado_en)).toEqual([
      entorno.ahora(),
      entorno.ahora(),
    ]);
    expect(acceso.status).toBe(401);
    // Las sesiones del administrador siguen abiertas.
    expect((await sesionesDe(adminId)).some((f) => f.revocado_en === null)).toBe(true);
  });

  it('una cuenta desactivada recibe 403 con la contraseña correcta y no se crea ninguna sesión', async () => {
    await entorno.bd.query('UPDATE contenido.usuario_interno SET activo = false WHERE id = $1', [
      docenteId,
    ]);

    const respuesta = await ingresar(DOCENTE.correo, DOCENTE.contrasena);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.codigo).toBe('SIN_PERMISO');
    expect(await sesionesDe(docenteId)).toEqual([]);
  });

  it('un estudiante no puede entrar a la consola con su correo y contraseña (CP-04 paso 3)', async () => {
    await entorno.bd.query(
      `INSERT INTO app.estudiante (nombre, correo, hash_contrasena, codigo_invitacion, creado_en)
       VALUES ('Eva', 'eva@ejemplo.cl', $1, 'ABC234', now())`,
      [await cifrarContrasena('clave-de-eva-1')],
    );

    const respuesta = await ingresar('eva@ejemplo.cl', 'clave-de-eva-1');
    const sinCuenta = await ingresar('nadie@ejemplo.cl', 'clave-de-eva-1');

    const { rows } = await entorno.bd.query(
      'SELECT 1 FROM app.token_sesion WHERE estudiante_id IS NOT NULL',
    );
    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual(sinCuenta.body);
    expect(rows).toEqual([]);
  });
});
