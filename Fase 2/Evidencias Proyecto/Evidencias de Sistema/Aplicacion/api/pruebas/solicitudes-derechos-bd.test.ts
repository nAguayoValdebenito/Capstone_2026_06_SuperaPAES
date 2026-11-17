// Solicitudes sobre los datos personales desde la app contra PostgreSQL real (HU-09.1, RF-A21,
// CU-14 3.b, A40): la solicitud queda pendiente con la fecha límite que fija el parámetro
// plazo_derechos_dias (leído por el servicio de administracion), y cada estudiante solo ve las suyas.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { usarBaseDeSesiones } from './base-sesiones.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';

const RUTA = '/api/v1/app/privacidad';
const CONTRASENA = 'clave-para-solicitar';
const DIA = 24 * 60 * 60 * 1000;

interface SolicitudHttp {
  id: number;
  solicitadoEn: string;
  venceEn: string;
}

/** El `data` de una respuesta, con el tipo que se espera. */
const datos = <T>(respuesta: { body: unknown }): T => (respuesta.body as { data: T }).data;

exigirBaseEnCi();
describe.skipIf(!urlBase)('solicitudes de datos desde la app con PostgreSQL (HU-09.1)', () => {
  const entorno = usarBaseDeSesiones('solicitudes_app');

  async function sesion(correo: string) {
    const id = await crearEstudianteDePrueba(entorno.bd, { correo, contrasena: CONTRASENA });
    const ingreso = await request(entorno.app)
      .post('/api/v1/app/cuentas/ingreso')
      .send({ correo, contrasena: CONTRASENA });
    expect(ingreso.status).toBe(200);
    return {
      id,
      conSesion: { Authorization: `Bearer ${ingreso.body.data.tokenAcceso as string}` },
    };
  }

  const fijarPlazo = (dias: number) =>
    entorno.bd.query(
      `UPDATE contenido.configuracion SET valor = $1 WHERE clave = 'plazo_derechos_dias'`,
      [String(dias)],
    );

  it('entrega los seis derechos de la Ley 21.719 desde contenido.tipo_derecho', async () => {
    const ana = await sesion('ana@ejemplo.cl');

    const respuesta = await request(entorno.app).get(`${RUTA}/tipos-derecho`).set(ana.conSesion);

    expect(respuesta.status).toBe(200);
    expect(datos<{ codigo: string }[]>(respuesta).map((tipo) => tipo.codigo)).toEqual([
      'acceso',
      'rectificacion',
      'supresion',
      'oposicion',
      'portabilidad',
      'bloqueo',
    ]);
  });

  it('la solicitud queda pendiente con la fecha límite del parámetro, y sigue al cambiarlo', async () => {
    const ana = await sesion('ana@ejemplo.cl');
    const enviar = (tipo: string) =>
      request(entorno.app).post(`${RUTA}/solicitudes`).set(ana.conSesion).send({ tipo });

    try {
      const conTreinta = await enviar('acceso');
      await fijarPlazo(10);
      const conDiez = await enviar('rectificacion');

      expect(conTreinta.status).toBe(201);
      expect(conTreinta.body.data).toMatchObject({
        tipo: { codigo: 'acceso', nombre: 'Acceso' },
        detalle: null,
        estado: { codigo: 'pendiente', nombre: 'Pendiente' },
        respondidoEn: null,
        respuesta: null,
      });
      const plazo = (cuerpo: SolicitudHttp) =>
        (Date.parse(cuerpo.venceEn) - Date.parse(cuerpo.solicitadoEn)) / DIA;
      const treinta = datos<SolicitudHttp>(conTreinta);
      expect(Date.parse(treinta.solicitadoEn)).toBe(entorno.ahora().getTime());
      expect(plazo(treinta)).toBe(30);
      expect(plazo(datos<SolicitudHttp>(conDiez))).toBe(10);

      const { rows } = await entorno.bd.query<{ dias: number; estado: string }>(
        `SELECT EXTRACT(EPOCH FROM s.vence_en - s.solicitado_en)::int / 86400 AS dias, e.codigo AS estado
           FROM app.solicitud_derecho s
           JOIN contenido.estado_solicitud e ON e.id = s.estado_solicitud_id
          WHERE s.estudiante_id = $1 ORDER BY s.id`,
        [ana.id],
      );
      // La primera conserva su plazo: el cambio del parámetro solo rige para las nuevas.
      expect(rows).toEqual([
        { dias: 30, estado: 'pendiente' },
        { dias: 10, estado: 'pendiente' },
      ]);
    } finally {
      await fijarPlazo(30);
    }
  });

  it('un tipo que no existe da 400 y no guarda nada', async () => {
    const ana = await sesion('ana@ejemplo.cl');

    const respuesta = await request(entorno.app)
      .post(`${RUTA}/solicitudes`)
      .set(ana.conSesion)
      .send({ tipo: 'olvido', detalle: 'Hola' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
    const { rows } = await entorno.bd.query(
      'SELECT 1 FROM app.solicitud_derecho WHERE estudiante_id = $1',
      [ana.id],
    );
    expect(rows).toHaveLength(0);
  });

  it('cada estudiante ve solo sus solicitudes, la más reciente primero, con estado y respuesta', async () => {
    const ana = await sesion('ana@ejemplo.cl');
    const beto = await sesion('beto@ejemplo.cl');
    const enviar = (conSesion: Record<string, string>, tipo: string, detalle?: string) =>
      request(entorno.app).post(`${RUTA}/solicitudes`).set(conSesion).send({ tipo, detalle });

    const primera = await enviar(ana.conSesion, 'acceso', 'Quiero una copia.');
    entorno.avanzarSegundos(60);
    const segunda = await enviar(ana.conSesion, 'bloqueo');
    await enviar(beto.conSesion, 'supresion', 'Borren mis datos.');
    // Una respuesta como la que dejará la consola (HU-55), para ver que la app la muestra.
    await entorno.bd.query(
      `UPDATE app.solicitud_derecho
          SET estado_solicitud_id = (SELECT id FROM contenido.estado_solicitud WHERE codigo = 'respondida'),
              respondido_en = solicitado_en + INTERVAL '1 day', respuesta = 'Te enviamos la copia.'
        WHERE id = $1`,
      [datos<SolicitudHttp>(primera).id],
    );

    const respuesta = await request(entorno.app).get(`${RUTA}/solicitudes`).set(ana.conSesion);

    expect(respuesta.status).toBe(200);
    expect(datos<SolicitudHttp[]>(respuesta).map((solicitud) => solicitud.id)).toEqual([
      datos<SolicitudHttp>(segunda).id,
      datos<SolicitudHttp>(primera).id,
    ]);
    expect(respuesta.body.data[1]).toMatchObject({
      detalle: 'Quiero una copia.',
      estado: { codigo: 'respondida', nombre: 'Respondida' },
      respuesta: 'Te enviamos la copia.',
    });
    expect(respuesta.body.data[1].respondidoEn).toEqual(expect.any(String));
    expect(JSON.stringify(respuesta.body)).not.toContain('Borren mis datos.');
  });
});
