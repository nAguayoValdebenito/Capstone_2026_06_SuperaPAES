// Borrado de la cuenta contra PostgreSQL real (HU-08.1, RF-A18, RNF-09, CU-14 paso 6, CP-34): no quedan el
// nombre, el correo, el perfil ni los puntajes; las evaluaciones y sus respuestas quedan seudonimizadas;
// la sesión se cierra, y nada de otro estudiante cambia. Antes de borrar, la app consulta la suscripción
// que la tienda sigue cobrando (HU-08.2, RN-34); Mis datos, los términos aceptados (CU-14 paso 2).
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';
import { prepararRespuestas } from './respuestas-de-prueba.js';
import { insertarSuscripcion } from './suscripciones-de-prueba.js';

const RUTA_BORRAR = '/api/v1/app/privacidad/cuenta';
const RUTA_PUNTAJES = '/api/v1/app/cuentas/puntajes';
const CONTRASENA = 'clave-para-practicar';

exigirBaseEnCi();
describe.skipIf(!urlBase)('borrado de la cuenta con PostgreSQL (HU-08)', () => {
  const r = prepararRespuestas('borrado');
  const { base, entorno } = r;

  const borrar = (token: string) =>
    request(entorno.app).delete(RUTA_BORRAR).set('Authorization', `Bearer ${token}`);
  const estadoDeLaCuenta = (token: string) =>
    request(entorno.app).get(RUTA_BORRAR).set('Authorization', `Bearer ${token}`);

  /** Una suscripción del plan en la tienda, con el estado indicado (la vigencia la pone la base). */
  const suscribir = (
    estudianteId: string,
    plan: string,
    estado: string,
    tienda: 'google_play' | 'app_store',
  ) => insertarSuscripcion(entorno.bd, { estudianteId, plan, estado, tienda });

  /** Una práctica de M1 con una bien (A) y una mal (B), cerrada; y el permiso con un puntaje. */
  async function practicarYCargar(token: string) {
    const conSesion = { Authorization: `Bearer ${token}` };
    const primera = await r.practicaConPregunta(token);
    await r.responderCon(token, primera, 'A');
    const segunda = { ...primera, itemId: await r.entregar(token, primera.practicaId) };
    await r.responderCon(token, segunda, 'B');
    expect((await base.cerrar(token, primera.practicaId)).status).toBe(200);
    const leido = await request(entorno.app).get(RUTA_PUNTAJES).set(conSesion);
    await request(entorno.app)
      .post(`${RUTA_PUNTAJES}/permiso`)
      .set(conSesion)
      .send({ documentoId: leido.body.data.permiso.documento.id as number });
    const cargado = await request(entorno.app)
      .put(RUTA_PUNTAJES)
      .set(conSesion)
      .send({ pruebaId: base.pruebaId, anioAdmision: 2025, puntaje: 650 });
    expect(cargado.status).toBe(200);
  }

  /** Cuántas filas de cada tabla tiene el estudiante. */
  async function filas(estudianteId: string) {
    const { rows } = await entorno.bd.query<Record<string, number>>(
      `SELECT
         (SELECT COUNT(*)::int FROM app.estudiante_prueba WHERE estudiante_id = $1) AS pruebas,
         (SELECT COUNT(*)::int FROM app.puntaje_paes WHERE estudiante_id = $1) AS puntajes,
         (SELECT COUNT(*)::int FROM app.evaluacion WHERE estudiante_id = $1) AS evaluaciones,
         (SELECT COUNT(*)::int FROM app.evaluacion_item i JOIN app.evaluacion e ON e.id = i.evaluacion_id
           WHERE e.estudiante_id = $1 AND i.es_correcta IS NOT NULL) AS respuestas,
         (SELECT COUNT(*)::int FROM app.resultado_evaluacion r JOIN app.evaluacion e ON e.id = r.evaluacion_id
           WHERE e.estudiante_id = $1) AS resultados,
         (SELECT COUNT(*)::int FROM app.token_sesion
           WHERE estudiante_id = $1 AND revocado_en IS NULL) AS "sesionesAbiertas",
         (SELECT COUNT(*)::int FROM app.consentimiento
           WHERE estudiante_id = $1 AND revocado_en IS NULL) AS "permisosVigentes"`,
      [estudianteId],
    );
    return rows[0];
  }

  it('elimina los datos personales y deja lo rendido seudonimizado (CP-34)', async () => {
    await base.publicar(6, { prueba: 'M1', dificultad: 'media' });
    const ana = await base.sesion('ana@ejemplo.cl');
    await practicarYCargar(ana.token);
    const beto = await base.sesion('beto@ejemplo.cl');
    await practicarYCargar(beto.token);
    const antesDeBeto = await filas(beto.id);

    const respuesta = await borrar(ana.token);

    expect(respuesta.status).toBe(200);
    expect(new Date(respuesta.body.data.eliminadaEn as string).getTime()).not.toBeNaN();
    const { rows } = await entorno.bd.query<Record<string, unknown>>(
      `SELECT nombre, correo, hash_contrasena AS hash, anio_egreso AS egreso, eliminado_en AS eliminado
         FROM app.estudiante WHERE id = $1`,
      [ana.id],
    );
    expect(rows[0]).toMatchObject({
      nombre: 'Cuenta eliminada',
      correo: `eliminada-${ana.id}@cuentas.invalid`,
      hash: '*',
      egreso: null,
    });
    expect(rows[0]?.eliminado).not.toBeNull();
    const { rows: rastro } = await entorno.bd.query(
      "SELECT 1 FROM app.estudiante WHERE lower(correo) = 'ana@ejemplo.cl'",
    );
    expect(rastro).toEqual([]);
    expect(await filas(ana.id)).toEqual({
      pruebas: 0,
      puntajes: 0,
      evaluaciones: 1,
      respuestas: 2,
      resultados: 1,
      sesionesAbiertas: 0,
      permisosVigentes: 0,
    });
    expect(await filas(beto.id)).toEqual(antesDeBeto);
  });

  it('cierra la sesión: el acceso y el ingreso dejan de servir', async () => {
    const ana = await base.sesion('ana@ejemplo.cl');

    expect((await borrar(ana.token)).status).toBe(200);

    expect((await borrar(ana.token)).status).toBe(401);
    expect(
      (await request(entorno.app).get(RUTA_PUNTAJES).set('Authorization', `Bearer ${ana.token}`))
        .status,
    ).toBe(401);
    const ingreso = await request(entorno.app)
      .post('/api/v1/app/cuentas/ingreso')
      .send({ correo: 'ana@ejemplo.cl', contrasena: CONTRASENA });
    expect(ingreso.status).toBe(401);
  });

  it('el mismo correo puede volver a registrarse después del borrado', async () => {
    const ana = await base.sesion('ana@ejemplo.cl');
    expect((await borrar(ana.token)).status).toBe(200);

    const nueva = await crearEstudianteDePrueba(entorno.bd, {
      correo: 'ana@ejemplo.cl',
      contrasena: CONTRASENA,
    });

    expect(nueva).not.toBe(ana.id);
  });

  it('sin suscripción no hay nada que avisar (A42)', async () => {
    const ana = await base.sesion('ana@ejemplo.cl');
    await suscribir(ana.id, 'Una prueba anual', 'cancelada', 'app_store');

    const respuesta = await estadoDeLaCuenta(ana.token);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({ suscripcionVigente: null, documentosAceptados: [] });
  });

  it('avisa la suscripción activa o en mora, solo la propia, y aun así deja borrar (RN-34, A42b)', async () => {
    const ana = await base.sesion('ana@ejemplo.cl');
    await suscribir(ana.id, 'Todas las pruebas mensual', 'activa', 'google_play');
    const beto = await base.sesion('beto@ejemplo.cl');
    await suscribir(beto.id, 'Una prueba anual', 'en_mora', 'app_store');

    expect((await estadoDeLaCuenta(ana.token)).body.data.suscripcionVigente).toEqual({
      estado: 'activa',
      plan: 'Todas las pruebas',
      periodicidad: 'mensual',
      tienda: 'google_play',
    });
    expect((await estadoDeLaCuenta(beto.token)).body.data.suscripcionVigente).toEqual({
      estado: 'en_mora',
      plan: 'Una prueba',
      periodicidad: 'anual',
      tienda: 'app_store',
    });

    expect((await borrar(ana.token)).status).toBe(200);
    // La suscripción queda seudonimizada con la cuenta (RN-17): la tienda la cancela, no la app.
    const { rows } = await entorno.bd.query(
      'SELECT 1 FROM app.suscripcion WHERE estudiante_id = $1 AND vigente',
      [ana.id],
    );
    expect(rows).toHaveLength(1);
  });

  it('entrega la última versión aceptada y vigente de los términos y la privacidad (CU-14 paso 2)', async () => {
    const ana = await base.sesion('ana@ejemplo.cl');
    const aceptar = (documento: string, haceDias: number, revocadoHaceDias: number | null = null) =>
      entorno.bd.query(
        `INSERT INTO app.consentimiento (estudiante_id, documento_legal_id, aceptado_en, revocado_en)
         SELECT $1, d.id, now() - $3 * INTERVAL '1 day', now() - $4 * INTERVAL '1 day'
           FROM contenido.documento_legal d
           JOIN contenido.tipo_documento_legal t ON t.id = d.tipo_documento_legal_id
          WHERE t.codigo = $2 AND d.version = '1.0'`,
        [ana.id, documento, haceDias, revocadoHaceDias],
      );
    await aceptar('terminos', 9);
    await aceptar('privacidad', 9, 5);
    await aceptar('privacidad', 2);
    await aceptar('puntajes', 1);

    const { documentosAceptados } = (await estadoDeLaCuenta(ana.token)).body.data as {
      documentosAceptados: { documento: string; version: string; aceptadoEn: string }[];
    };

    expect(documentosAceptados.map(({ documento, version }) => [documento, version])).toEqual([
      ['terminos', '1.0'],
      ['privacidad', '1.0'],
    ]);
    const dias = documentosAceptados.map(({ aceptadoEn }) =>
      Math.round((Date.now() - new Date(aceptadoEn).getTime()) / 86_400_000),
    );
    expect(dias).toEqual([9, 2]);
  });

  it('sin sesión responde 401 y no borra nada', async () => {
    const ana = await base.sesion('ana@ejemplo.cl');

    const respuesta = await request(entorno.app).delete(RUTA_BORRAR);

    expect(respuesta.status).toBe(401);
    expect((await request(entorno.app).get(RUTA_BORRAR)).status).toBe(401);
    const { rows } = await entorno.bd.query(
      'SELECT 1 FROM app.estudiante WHERE id = $1 AND eliminado_en IS NULL',
      [ana.id],
    );
    expect(rows).toHaveLength(1);
  });
});
