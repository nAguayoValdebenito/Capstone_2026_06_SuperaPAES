// CP-03 completo contra PostgreSQL real (HU-05.3, HU-05 escenarios 2 a 4, CU-02, CU-02b, RN-01): al
// verificar el correo, o cuando el administrador confirma la cuenta, el cupo de hoy sube a
// cupo_verificado (20) desde ese momento, sin tocar las preguntas ya usadas. Pasos del caso:
//   1. Abrir el enlace del correo en una cuenta y escribir el código de 6 dígitos en otra.
//   2. Consultar el cupo del día.
//   3. Pedir que se reenvíe el correo desde otra cuenta sin verificar.
//   4. Confirmar desde la consola, con el administrador, otra cuenta sin verificar.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { usarBaseDeSesiones } from './base-sesiones.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { conToken, RUTA_INGRESO } from './escenario-sesiones.js';
import {
  estudianteConSesion,
  pedirCorreo,
  verificarConCodigo,
  verificarConEnlace,
} from './verificacion-de-prueba.js';

describe('CP-03 sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('CP-03 con PostgreSQL: el cupo sube de 10 a 20 al verificar', () => {
  const entorno = usarBaseDeSesiones('cp03');

  /** Fila de hoy (app.hoy_chile()) de app.cupo_diario, como la crearía el cupo (HU-32.1). */
  const crearCupoDeHoy = (estudianteId: string, maximo: number, usadas: number) =>
    entorno.bd.query(
      'INSERT INTO app.cupo_diario (estudiante_id, fecha, maximo, usadas) VALUES ($1, app.hoy_chile(), $2, $3)',
      [estudianteId, maximo, usadas],
    );
  const cupoDeHoy = async (estudianteId: string) =>
    (
      await entorno.bd.query<{ maximo: number; usadas: number }>(
        'SELECT maximo, usadas FROM app.cupo_diario WHERE estudiante_id = $1 AND fecha = app.hoy_chile()',
        [estudianteId],
      )
    ).rows[0];
  const cambiarCupoVerificado = (valor: number) =>
    entorno.bd.query(
      `UPDATE contenido.configuracion SET valor = $1::jsonb WHERE clave = 'cupo_verificado'`,
      [JSON.stringify(valor)],
    );

  it('pasos 1 y 2: con el enlace en una cuenta y con el código en otra, el cupo de hoy sube a 20 sin tocar las usadas', async () => {
    const conEnlace = await estudianteConSesion(entorno);
    const conCodigo = await estudianteConSesion(entorno);
    await crearCupoDeHoy(conEnlace.id, 10, 3);
    await crearCupoDeHoy(conCodigo.id, 10, 7);

    const enlace = await verificarConEnlace(
      entorno,
      (await pedirCorreo(entorno, conEnlace.sesion)).token,
    );
    const codigo = await verificarConCodigo(
      entorno,
      conCodigo.sesion,
      (await pedirCorreo(entorno, conCodigo.sesion)).codigo,
    );

    expect([enlace.status, codigo.status]).toEqual([200, 200]);
    expect(await cupoDeHoy(conEnlace.id)).toEqual({ maximo: 20, usadas: 3 });
    expect(await cupoDeHoy(conCodigo.id)).toEqual({ maximo: 20, usadas: 7 });
  });

  it('paso 3: reenviar desde otra cuenta invalida el enlace y el código anteriores; el nuevo sube el cupo', async () => {
    const eva = await estudianteConSesion(entorno);
    await crearCupoDeHoy(eva.id, 10, 0);
    const anterior = await pedirCorreo(entorno, eva.sesion);
    const nuevo = await pedirCorreo(entorno, eva.sesion);

    const enlaceAnterior = await verificarConEnlace(entorno, anterior.token);
    const codigoAnterior = await verificarConCodigo(entorno, eva.sesion, anterior.codigo);
    const cupoAntes = await cupoDeHoy(eva.id);
    const conElNuevo = await verificarConEnlace(entorno, nuevo.token);

    expect(enlaceAnterior.body.error.codigo).toBe('VERIFICACION_NO_VIGENTE');
    expect(codigoAnterior.body.error.codigo).toBe('CODIGO_INCORRECTO');
    expect(cupoAntes).toEqual({ maximo: 10, usadas: 0 });
    expect(conElNuevo.status).toBe(200);
    expect(await cupoDeHoy(eva.id)).toEqual({ maximo: 20, usadas: 0 });
  });

  it('paso 4: el administrador confirma otra cuenta, que queda verificada, con 20 y con su fila de auditoría', async () => {
    const eva = await estudianteConSesion(entorno);
    await crearCupoDeHoy(eva.id, 10, 4);
    const credenciales = await entorno.crearAdmin();
    const ingreso = await request(entorno.app).post(RUTA_INGRESO).send(credenciales);

    const respuesta = await request(entorno.app)
      .post(`/api/v1/admin/cuentas/estudiantes/${eva.id}/confirmar-correo`)
      .set(conToken(ingreso.body.data.tokenAcceso as string));

    const { rows } = await entorno.bd.query(
      `SELECT 1 FROM contenido.auditoria a
         JOIN contenido.accion_auditoria aa ON aa.id = a.accion_auditoria_id
        WHERE aa.codigo = 'confirmar_cuenta' AND a.entidad = 'estudiante' AND a.entidad_id = $1`,
      [eva.id],
    );
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.correoVerificado).toBe(true);
    expect(await cupoDeHoy(eva.id)).toEqual({ maximo: 20, usadas: 4 });
    expect(rows).toHaveLength(1);
  });

  it('si todavía no existe la fila de hoy, verificar no crea ninguna', async () => {
    const eva = await estudianteConSesion(entorno);

    await verificarConEnlace(entorno, (await pedirCorreo(entorno, eva.sesion)).token);

    expect(await cupoDeHoy(eva.id)).toBeUndefined();
  });

  it('el nuevo máximo sale de la configuración (cupo_verificado), no del código', async () => {
    const eva = await estudianteConSesion(entorno);
    await crearCupoDeHoy(eva.id, 10, 2);
    await cambiarCupoVerificado(25);
    try {
      await verificarConEnlace(entorno, (await pedirCorreo(entorno, eva.sesion)).token);
    } finally {
      await cambiarCupoVerificado(20);
    }

    expect(await cupoDeHoy(eva.id)).toEqual({ maximo: 25, usadas: 2 });
  });

  it('verificar otra vez no vuelve a subir nada, y el máximo nunca baja', async () => {
    const eva = await estudianteConSesion(entorno);
    const otra = await estudianteConSesion(entorno);
    await crearCupoDeHoy(eva.id, 10, 0);
    await crearCupoDeHoy(otra.id, 30, 0);
    const { token } = await pedirCorreo(entorno, eva.sesion);
    await verificarConEnlace(entorno, token);
    await cambiarCupoVerificado(40);
    try {
      const otraVez = await verificarConEnlace(entorno, token);
      expect(otraVez.body.data.yaVerificado).toBe(true);
    } finally {
      await cambiarCupoVerificado(20);
    }
    await verificarConEnlace(entorno, (await pedirCorreo(entorno, otra.sesion)).token);

    expect(await cupoDeHoy(eva.id)).toEqual({ maximo: 20, usadas: 0 });
    expect(await cupoDeHoy(otra.id)).toEqual({ maximo: 30, usadas: 0 });
  });
});
