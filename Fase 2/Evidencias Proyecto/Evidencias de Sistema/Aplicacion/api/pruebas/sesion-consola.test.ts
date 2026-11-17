// Sesión de la consola (HU-02.1 en su parte de consola, HU-02.3, RNF-01, CU-23 3.b), sin base real:
// ingreso, usuario de la sesión y límite de intentos por IP y por correo. Renovar, cerrar, el
// vencimiento y el cierre de sesiones al desactivar están en sesion-consola-renovar.test.ts; las
// mismas reglas contra PostgreSQL, en sesion-consola-bd.test.ts.
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { firmarToken } from '../comun/jwt.js';
import {
  DURACION_TOKEN_ACCESO_SEGUNDOS,
  DURACION_TOKEN_RENOVACION_SEGUNDOS,
} from '../modulos/cuentas/cuentas.servicio.js';
import { errorConFormato, SECRETO_DE_PRUEBA } from './ayudantes.js';
import {
  ADMIN,
  conCuentas,
  conToken,
  crearEscenarioSesiones,
  DOCENTE,
  RUTA_YO,
  sesionDe,
  sha256,
} from './escenario-sesiones.js';

describe('ingreso a la consola', () => {
  it('el administrador entra: tokens y datos mínimos, sin el hash', async () => {
    const escenario = await conCuentas();

    const respuesta = await escenario.ingresar(ADMIN.correo, ADMIN.contrasena);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      data: {
        tokenAcceso: expect.any(String) as string,
        tokenRenovacion: expect.any(String) as string,
        usuario: {
          id: Number(escenario.adminId),
          nombre: 'Ana Admin',
          correo: ADMIN.correo,
          rol: 'admin',
        },
      },
      error: null,
      meta: null,
    });
    expect(JSON.stringify(respuesta.body)).not.toMatch(/\$2[aby]\$|hash/i);
  });

  it('guarda solo el SHA-256 del token de renovación y actualiza el último acceso', async () => {
    const escenario = await conCuentas();

    const { tokenRenovacion } = await sesionDe(escenario);

    const [fila] = [...escenario.sesiones.values()];
    expect(fila).toMatchObject({ tipo: 'admin', cuentaId: escenario.adminId, revocadoEn: null });
    expect(fila?.hashToken).toBe(sha256(tokenRenovacion));
    expect(fila?.hashToken).not.toBe(tokenRenovacion);
    expect(Buffer.from(tokenRenovacion, 'base64url')).toHaveLength(32);
    const vence = escenario.ahora().getTime() + DURACION_TOKEN_RENOVACION_SEGUNDOS.admin * 1000;
    expect(fila?.expiraEn.getTime()).toBe(vence);
    expect(escenario.usuarios.get(escenario.adminId)?.ultimoAcceso).toEqual(escenario.ahora());
  });

  it('el docente entra con su rol, aunque escriba el correo con mayúsculas', async () => {
    const escenario = await conCuentas();

    const respuesta = await escenario.ingresar('Diego@Ejemplo.CL', DOCENTE.contrasena);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.usuario).toMatchObject({ rol: 'docente', correo: DOCENTE.correo });
  });

  it('contraseña incorrecta y correo inexistente reciben la misma respuesta, sin sesión', async () => {
    const escenario = await conCuentas();

    const malaClave = await escenario.ingresar(ADMIN.correo, 'otra-clave-1');
    const sinCuenta = await escenario.ingresar('nadie@ejemplo.cl', ADMIN.contrasena);

    expect(malaClave.status).toBe(401);
    expect(malaClave.body).toEqual(errorConFormato('NO_AUTENTICADO'));
    expect(sinCuenta.status).toBe(malaClave.status);
    expect(sinCuenta.body).toEqual(malaClave.body);
    expect(escenario.sesiones.size).toBe(0);
  });

  it('con un correo inexistente compara igual contra un hash de relleno (el tiempo no lo delata)', async () => {
    const escenario = await conCuentas();
    const comparar = vi.spyOn(bcrypt, 'compare');

    await escenario.ingresar('nadie@ejemplo.cl', 'cualquier-clave');

    expect(comparar).toHaveBeenCalledTimes(1);
  });

  it('una cuenta desactivada con la contraseña correcta recibe 403 y ninguna sesión (CU-23 3.b)', async () => {
    const escenario = await conCuentas();
    await escenario.crearCuenta({ ...DOCENTE, correo: 'inactivo@ejemplo.cl', activo: false });

    const correcta = await escenario.ingresar('inactivo@ejemplo.cl', DOCENTE.contrasena);
    const incorrecta = await escenario.ingresar('inactivo@ejemplo.cl', 'otra-clave-1');

    expect(correcta.status).toBe(403);
    expect(correcta.body).toEqual(errorConFormato('CUENTA_DESACTIVADA'));
    expect(correcta.body.error.mensaje).toMatch(/desactivada[\s\S]*administrador/);
    // Con una contraseña incorrecta no se revela que la cuenta existe y está desactivada.
    expect(incorrecta.status).toBe(401);
    expect(escenario.sesiones.size).toBe(0);
  });

  it('valida el cuerpo antes de buscar la cuenta', async () => {
    const escenario = await conCuentas();

    const respuesta = await escenario.ingresar('no-es-correo', 'x');

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });
});

describe('usuario de la sesión (GET /admin/cuentas/yo)', () => {
  it('un token bien firmado de una cuenta que no existe recibe 401', async () => {
    const escenario = await conCuentas();
    await sesionDe(escenario);
    const [sid = ''] = escenario.sesiones.keys();
    const vigencia = { desde: escenario.ahora(), segundos: DURACION_TOKEN_ACCESO_SEGUNDOS };
    const ajeno = await firmarToken(
      'admin',
      { sub: '999', sid, rol: 'admin' },
      SECRETO_DE_PRUEBA,
      vigencia,
    );

    const respuesta = await request(escenario.app).get(RUTA_YO).set(conToken(ajeno));

    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual(errorConFormato('NO_AUTENTICADO'));
  });

  it('el administrador recibe id, nombre, correo y rol, sin áreas', async () => {
    const escenario = await conCuentas();
    const { tokenAcceso } = await sesionDe(escenario);

    const respuesta = await request(escenario.app).get(RUTA_YO).set(conToken(tokenAcceso));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({
      id: Number(escenario.adminId),
      nombre: 'Ana Admin',
      correo: ADMIN.correo,
      rol: 'admin',
    });
  });

  it('el docente también recibe sus áreas de especialidad', async () => {
    const escenario = await conCuentas();
    const { tokenAcceso } = await sesionDe(escenario, DOCENTE);

    const respuesta = await request(escenario.app).get(RUTA_YO).set(conToken(tokenAcceso));

    expect(respuesta.body.data).toMatchObject({ rol: 'docente', areas: [1, 2] });
  });

  it('sin token responde 401', async () => {
    const escenario = await conCuentas();

    expect((await request(escenario.app).get(RUTA_YO)).status).toBe(401);
  });
});

describe('límite de intentos del ingreso (RNF-02)', () => {
  const conLimite = async () => {
    const escenario = crearEscenarioSesiones({ limiteIntentos: { ventanaMs: 60_000, maximo: 2 } });
    await escenario.crearCuenta(ADMIN);
    return escenario;
  };

  it('por correo: los intentos fallidos desde distintas IP cuentan para la misma cuenta', async () => {
    const escenario = await conLimite();
    await escenario.ingresar(ADMIN.correo, 'mala-1', '203.0.113.1');
    await escenario.ingresar(ADMIN.correo, 'mala-2', '203.0.113.2');

    const tercero = await escenario.ingresar(ADMIN.correo, ADMIN.contrasena, '203.0.113.3');

    expect(tercero.status).toBe(429);
    expect(tercero.body).toEqual(errorConFormato('DEMASIADOS_INTENTOS'));
  });

  it('por IP: los intentos fallidos con distintos correos cuentan para la misma IP', async () => {
    const escenario = await conLimite();
    await escenario.ingresar('uno@ejemplo.cl', 'mala-1');
    await escenario.ingresar('dos@ejemplo.cl', 'mala-2');

    const tercero = await escenario.ingresar(ADMIN.correo, ADMIN.contrasena);

    expect(tercero.status).toBe(429);
  });

  it('los ingresos correctos no cuentan', async () => {
    const escenario = await conLimite();

    const estados = [];
    for (let i = 0; i < 3; i++) {
      estados.push((await escenario.ingresar(ADMIN.correo, ADMIN.contrasena)).status);
    }

    expect(estados).toEqual([200, 200, 200]);
  });
});
