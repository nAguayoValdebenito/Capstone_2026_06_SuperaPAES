// TEC-07 (DAS 2.5 y 4.3.3): GET /api/v1/app/cuentas/yo entrega al estudiante con sesión si su correo está
// verificado, su cupo del día y las versiones aceptadas de los términos y la política, para que la app
// se entere de una verificación hecha con el enlace sin volver a iniciar sesión. Solo sus datos.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararRespuestas } from './respuestas-de-prueba.js';

const RUTA_YO = '/api/v1/app/cuentas/yo';
const RUTA_ENLACE = '/api/v1/app/cuentas/verificacion/enlace';

exigirBaseEnCi();
describe.skipIf(!urlBase)('estado de la cuenta de la app con PostgreSQL (GET /cuentas/yo)', () => {
  const r = prepararRespuestas('estado_cuenta');
  const { base, entorno } = r;

  const yo = (token?: string) => {
    const peticion = request(entorno.app).get(RUTA_YO);
    return token ? peticion.set('Authorization', `Bearer ${token}`) : peticion;
  };

  const aceptar = (estudianteId: string, documento: string, haceDias: number) =>
    entorno.bd.query(
      `INSERT INTO app.consentimiento (estudiante_id, documento_legal_id, aceptado_en)
       SELECT $1, d.id, now() - $3 * INTERVAL '1 day'
         FROM contenido.documento_legal d
         JOIN contenido.tipo_documento_legal t ON t.id = d.tipo_documento_legal_id
        WHERE t.codigo = $2 AND d.version = '1.0'`,
      [estudianteId, documento, haceDias],
    );

  const verificar = (estudianteId: string) =>
    entorno.bd.query(
      'UPDATE app.estudiante SET correo_verificado = true, verificado_en = now() WHERE id = $1',
      [estudianteId],
    );

  it('sin sesión responde 401', async () => {
    const respuesta = await yo();
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe('NO_AUTENTICADO');
  });

  it('un token de la consola no sirve en la app', async () => {
    expect((await yo('token-que-no-es-de-la-app')).status).toBe(401);
  });

  it('estudiante sin verificar: correo sin verificar, cupo de 10 y sin términos aceptados', async () => {
    const ana = await base.sesion('ana@ejemplo.cl');
    const respuesta = await yo(ana.token);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      correoVerificado: false,
      cupo: { maximo: 10, usadas: 0, restantes: 10, saldoExtra: 0 },
      documentosAceptados: [],
    });
    expect(respuesta.body.meta).toBeNull();
  });

  it('estudiante verificado: correo verificado y cupo de 20', async () => {
    const beto = await base.sesion('beto@ejemplo.cl');
    await verificar(beto.id);
    const respuesta = await yo(beto.token);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      correoVerificado: true,
      cupo: { maximo: 20, restantes: 20 },
    });
  });

  it('refleja el cupo gastado y las versiones aceptadas de los términos y la política, con su fecha', async () => {
    const carla = await base.sesion('carla@ejemplo.cl');
    await aceptar(carla.id, 'terminos', 9);
    await aceptar(carla.id, 'privacidad', 2);
    await aceptar(carla.id, 'puntajes', 1);
    await base.publicar(5, { prueba: 'M1', dificultad: 'media' });
    const practica = await r.practicaConPregunta(carla.token);
    await r.responderCon(carla.token, practica, 'A');

    const { cupo, documentosAceptados } = (await yo(carla.token)).body.data as {
      cupo: { usadas: number; restantes: number };
      documentosAceptados: { documento: string; version: string; aceptadoEn: string }[];
    };

    expect(cupo).toMatchObject({ usadas: 1, restantes: 9 });
    expect(documentosAceptados.map((d) => [d.documento, d.version])).toEqual([
      ['terminos', '1.0'],
      ['privacidad', '1.0'],
    ]);
    const dias = documentosAceptados.map((d) =>
      Math.round((Date.now() - new Date(d.aceptadoEn).getTime()) / 86_400_000),
    );
    expect(dias).toEqual([9, 2]);
  });

  it('solo trae lo del estudiante de la sesión: nada de otros usuarios ni datos personales', async () => {
    const diego = await base.sesion('diego@ejemplo.cl');
    const elena = await base.sesion('elena@ejemplo.cl');
    await aceptar(elena.id, 'terminos', 3);

    const respuesta = (await yo(diego.token)).body.data as Record<string, unknown>;
    expect(respuesta['documentosAceptados']).toEqual([]);
    expect(Object.keys(respuesta).sort()).toEqual([
      'correoVerificado',
      'cupo',
      'documentosAceptados',
    ]);
    const texto = JSON.stringify(respuesta);
    for (const dato of ['diego@ejemplo.cl', 'elena@ejemplo.cl', 'hash', 'contrasena', 'token'])
      expect(texto).not.toContain(dato);
  });

  it('se entera de la verificación hecha con el enlace sin volver a iniciar sesión (DAS 4.3.3)', async () => {
    const fabio = await base.sesion('fabio@ejemplo.cl');
    expect((await yo(fabio.token)).body.data.correoVerificado).toBe(false);

    // El correo se verifica desde otro navegador; la sesión de la app sigue siendo la misma.
    await verificar(fabio.id);
    const despues = (await yo(fabio.token)).body.data as {
      correoVerificado: boolean;
      cupo: { maximo: number };
    };
    expect(despues.correoVerificado).toBe(true);
    expect(despues.cupo.maximo).toBe(20);
    expect(RUTA_ENLACE).toContain('/verificacion/enlace');
  });
});
