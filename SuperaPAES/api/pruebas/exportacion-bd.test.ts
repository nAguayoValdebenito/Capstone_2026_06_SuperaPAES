// Descarga de los datos del estudiante contra PostgreSQL real (HU-07.1, RF-A18, CU-14 3.a, CP-26): la
// cuenta sin la contraseña, los documentos aceptados, el perfil, las evaluaciones con sus respuestas y
// resultados, y los puntajes, solo del estudiante de la sesión.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararRespuestas } from './respuestas-de-prueba.js';

const RUTA_MIS_DATOS = '/api/v1/app/privacidad/mis-datos';
const RUTA_PUNTAJES = '/api/v1/app/cuentas/puntajes';

/** Lo que revisan estas pruebas del archivo de datos. */
interface DatosExportados {
  cuenta: { id: number; correo: string };
  consentimientos: unknown[];
  perfil: { pruebas: number[] };
  evaluaciones: { respuestas: { preguntaId: unknown }[] }[];
  puntajes: unknown[];
}

exigirBaseEnCi();
describe.skipIf(!urlBase)('descarga de los datos del estudiante con PostgreSQL (HU-07.1)', () => {
  const r = prepararRespuestas('exportacion');
  const { base, entorno } = r;

  /** Una práctica de M1 con la primera pregunta bien (A) y la segunda mal (B), ya cerrada. */
  async function practicar(token: string) {
    const primera = await r.practicaConPregunta(token);
    expect((await r.responderCon(token, primera, 'A')).status).toBe(200);
    const segunda = { ...primera, itemId: await r.entregar(token, primera.practicaId) };
    expect((await r.responderCon(token, segunda, 'B')).status).toBe(200);
    expect((await base.cerrar(token, primera.practicaId)).status).toBe(200);
    return primera.practicaId;
  }

  /** Da el permiso de puntajes vigente y carga M1 de la admisión 2025 con 650 puntos. */
  async function cargarPuntaje(token: string) {
    const conSesion = { Authorization: `Bearer ${token}` };
    const leido = await request(entorno.app).get(RUTA_PUNTAJES).set(conSesion);
    const documentoId = leido.body.data.permiso.documento.id as number;
    await request(entorno.app)
      .post(`${RUTA_PUNTAJES}/permiso`)
      .set(conSesion)
      .send({ documentoId });
    const cargado = await request(entorno.app)
      .put(RUTA_PUNTAJES)
      .set(conSesion)
      .send({ pruebaId: base.pruebaId, anioAdmision: 2025, puntaje: 650 });
    expect(cargado.status).toBe(200);
  }

  it('entrega la cuenta, el perfil, las respuestas y los puntajes del estudiante (CP-26)', async () => {
    await base.publicar(6, { prueba: 'M1', dificultad: 'media' });
    const ana = await base.sesion('ana@ejemplo.cl');
    const practicaId = await practicar(ana.token);
    await cargarPuntaje(ana.token);
    // Otro estudiante con su propia práctica: nada suyo debe salir.
    const beto = await base.sesion('beto@ejemplo.cl');
    await practicar(beto.token);

    const respuesta = await request(entorno.app)
      .get(RUTA_MIS_DATOS)
      .set('Authorization', `Bearer ${ana.token}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['cache-control']).toBe('no-store');
    const datos = respuesta.body.data as DatosExportados;
    expect(datos.cuenta).toMatchObject({ id: Number(ana.id), correo: 'ana@ejemplo.cl' });
    expect(JSON.stringify(datos)).not.toMatch(/hash|contrasena/i);
    expect(datos.consentimientos).toContainEqual(
      expect.objectContaining({ documento: 'puntajes', version: '1.0', revocadoEn: null }),
    );
    expect(datos.perfil.pruebas).toEqual([base.pruebaId]);
    expect(datos.evaluaciones).toHaveLength(1);
    const [practica] = datos.evaluaciones;
    expect(practica).toMatchObject({
      id: Number(practicaId),
      tipo: 'practica',
      prueba: { codigo: 'M1' },
      resultado: { correctas: 1, incorrectas: 1 },
    });
    expect(practica?.respuestas.slice(0, 2)).toEqual([
      expect.objectContaining({ orden: 1, alternativa: 'A', correcta: true }),
      expect.objectContaining({ orden: 2, alternativa: 'B', correcta: false }),
    ]);
    expect(typeof practica?.respuestas[0]?.preguntaId).toBe('number');
    expect(datos.puntajes).toEqual([
      expect.objectContaining({ pruebaId: base.pruebaId, anioAdmision: 2025, puntaje: 650 }),
    ]);
  });

  it('sin evaluaciones ni puntajes entrega las listas vacías', async () => {
    const { token } = await base.sesion('nueva@ejemplo.cl');

    const respuesta = await request(entorno.app)
      .get(RUTA_MIS_DATOS)
      .set('Authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({ evaluaciones: [], puntajes: [] });
  });

  it('sin la sesión de la app responde 401', async () => {
    expect((await request(entorno.app).get(RUTA_MIS_DATOS)).status).toBe(401);
  });
});
