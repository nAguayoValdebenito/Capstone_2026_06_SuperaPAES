// Bandeja y respuesta de las solicitudes de datos en la consola contra PostgreSQL real (HU-55.1,
// RF-C10, C14): orden por fecha límite, vencidas marcadas, la respuesta guarda estado, texto, autor y
// fecha con su auditoría en la misma transacción (si la auditoría falla no queda nada), dos respuestas a
// la vez dejan una sola y una cuenta eliminada (seudonimizada, HU-08) se lista y se atiende sin error.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { usarBaseDeSesiones } from './base-sesiones.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';
import { crearPrivacidadServicio } from '../modulos/privacidad/privacidad.servicio.js';

const RUTA = '/api/v1/admin/privacidad/solicitudes';
const CONTRASENA = 'clave-para-solicitar';
const DIA = 24 * 60 * 60 * 1000;

interface SolicitudHttp {
  id: number;
  estado: { codigo: string };
  vencida: boolean;
  diasRestantes: number | null;
  estudiante: {
    id: number;
    nombre: string | null;
    correo: string | null;
    cuentaEliminada: boolean;
  };
}

/** El `data` de una respuesta, con el tipo que se espera. */
const datos = <T>(respuesta: { body: unknown }): T => (respuesta.body as { data: T }).data;

exigirBaseEnCi();
describe.skipIf(!urlBase)('solicitudes de datos en la consola con PostgreSQL (HU-55.1)', () => {
  const entorno = usarBaseDeSesiones('solicitudes_consola');

  async function sesionAdmin() {
    const credenciales = await entorno.crearAdmin();
    const ingreso = await request(entorno.app)
      .post('/api/v1/admin/cuentas/ingreso')
      .send(credenciales);
    const { rows } = await entorno.bd.query<{ id: string }>(
      'SELECT id::text AS id FROM contenido.usuario_interno WHERE correo = $1',
      [credenciales.correo],
    );
    const token = ingreso.body.data.tokenAcceso as string;
    return { id: rows[0]?.id ?? '', conSesion: { Authorization: `Bearer ${token}` } };
  }

  /** Una solicitud pendiente recibida hace `haceDias`, que vence en `venceEnDias` (negativo: vencida). */
  async function solicitud(
    estudianteId: string,
    tipo: string,
    haceDias: number,
    venceEnDias: number,
  ) {
    const ahora = entorno.ahora().getTime();
    const { rows } = await entorno.bd.query<{ id: string }>(
      `INSERT INTO app.solicitud_derecho
         (estudiante_id, tipo_derecho_id, detalle, estado_solicitud_id, solicitado_en, vence_en)
       SELECT $1, td.id, 'Detalle de prueba', es.id, $3, $4
         FROM contenido.tipo_derecho td, contenido.estado_solicitud es
        WHERE td.codigo = $2 AND es.codigo = 'pendiente'
       RETURNING id::text AS id`,
      [estudianteId, tipo, new Date(ahora - haceDias * DIA), new Date(ahora + venceEnDias * DIA)],
    );
    return rows[0]?.id ?? '';
  }

  const estudiante = (correo: string) =>
    crearEstudianteDePrueba(entorno.bd, { correo, contrasena: CONTRASENA });

  const fila = async (id: string) =>
    (
      await entorno.bd.query<{
        estado: string;
        respuesta: string | null;
        atendido_por: string | null;
        respondido_en: Date | null;
      }>(
        `SELECT e.codigo AS estado, s.respuesta, s.atendido_por::text AS atendido_por, s.respondido_en
           FROM app.solicitud_derecho s
           JOIN contenido.estado_solicitud e ON e.id = s.estado_solicitud_id
          WHERE s.id = $1`,
        [id],
      )
    ).rows[0];

  const auditorias = async (id: string) =>
    (
      await entorno.bd.query<{ usuario_id: string; antes: unknown; despues: unknown }>(
        `SELECT a.usuario_id::text AS usuario_id, a.antes, a.despues
           FROM contenido.auditoria a
           JOIN contenido.accion_auditoria aa ON aa.id = a.accion_auditoria_id
          WHERE aa.codigo = 'responder_solicitud' AND a.entidad = 'solicitud_derecho'
            AND a.entidad_id = $1`,
        [id],
      )
    ).rows;

  it('lista las pendientes con la fecha límite más próxima primero y marca las vencidas', async () => {
    const admin = await sesionAdmin();
    const ana = await estudiante('ana@ejemplo.cl');
    const lejana = await solicitud(ana, 'acceso', 2, 28);
    const vencida = await solicitud(ana, 'rectificacion', 32, -2);
    const proxima = await solicitud(ana, 'bloqueo', 25, 5);

    const respuesta = await request(entorno.app).get(RUTA).set(admin.conSesion);

    expect(respuesta.status).toBe(200);
    const lista = datos<{ solicitudes: SolicitudHttp[]; pendientes: number }>(respuesta);
    expect(lista.solicitudes.map((s) => String(s.id))).toEqual([vencida, proxima, lejana]);
    expect(lista.solicitudes.map((s) => s.vencida)).toEqual([true, false, false]);
    expect(lista.solicitudes[0]?.diasRestantes).toBeLessThan(0);
    expect(lista.pendientes).toBe(3);
    expect(respuesta.body.meta).toEqual({ pagina: 1, porPagina: 20, total: 3 });
    expect(lista.solicitudes[0]?.estudiante).toMatchObject({
      nombre: 'Eva Estudiante',
      correo: 'ana@ejemplo.cl',
      cuentaEliminada: false,
    });
  });

  it('responder guarda estado, texto, autor y fecha, y la auditoría con el antes y el después', async () => {
    const admin = await sesionAdmin();
    const ana = await estudiante('ana@ejemplo.cl');
    const id = await solicitud(ana, 'acceso', 1, 29);

    const respuesta = await request(entorno.app)
      .patch(`${RUTA}/${id}`)
      .set(admin.conSesion)
      .send({ estado: 'respondida', respuesta: 'Te enviamos la copia de tus datos.' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      estado: { codigo: 'respondida', nombre: 'Respondida' },
      respuesta: 'Te enviamos la copia de tus datos.',
      atendidoPor: { id: Number(admin.id) },
      vencida: false,
      diasRestantes: null,
    });
    expect(await fila(id)).toEqual({
      estado: 'respondida',
      respuesta: 'Te enviamos la copia de tus datos.',
      atendido_por: admin.id,
      respondido_en: entorno.ahora(),
    });
    expect(await auditorias(id)).toEqual([
      {
        usuario_id: admin.id,
        antes: { estado: 'pendiente' },
        despues: {
          estado: 'respondida',
          respondidoEn: entorno.ahora().toISOString(),
          atendidoPor: admin.id,
        },
      },
    ]);
    const respondidas = await request(entorno.app)
      .get(`${RUTA}?estado=respondida`)
      .set(admin.conSesion);
    expect(datos<{ solicitudes: SolicitudHttp[] }>(respondidas).solicitudes).toHaveLength(1);
  });

  it('si la auditoría falla, la solicitud sigue pendiente y sin respuesta', async () => {
    const admin = await sesionAdmin();
    const ana = await estudiante('ana@ejemplo.cl');
    const id = await solicitud(ana, 'oposicion', 1, 29);
    const privacidad = crearPrivacidadServicio({
      bd: entorno.bd,
      unidadDeTrabajo: entorno.unidadDeTrabajo,
      cuentas: {} as never,
      evaluaciones: { exportarEvaluaciones: () => Promise.resolve([]) },
      suscripciones: { vigenteDe: () => Promise.resolve(null) },
      administracion: {
        obtenerParametroEntero: () => Promise.resolve(30),
        registrarAuditoria: () => Promise.reject(new Error('La auditoría no respondió.')),
      },
      reloj: () => entorno.ahora(),
    });

    await expect(
      privacidad.atenderSolicitud(admin.id, id, { estado: 'rechazada', respuesta: 'No procede.' }),
    ).rejects.toThrow('La auditoría no respondió.');

    expect(await fila(id)).toEqual({
      estado: 'pendiente',
      respuesta: null,
      atendido_por: null,
      respondido_en: null,
    });
    expect(await auditorias(id)).toEqual([]);
  });

  it('dos respuestas a la vez a la misma solicitud dejan una sola; la otra recibe 409', async () => {
    const admin = await sesionAdmin();
    const ana = await estudiante('ana@ejemplo.cl');
    const id = await solicitud(ana, 'supresion', 1, 29);
    const atender = (estado: string, texto: string) =>
      request(entorno.app)
        .patch(`${RUTA}/${id}`)
        .set(admin.conSesion)
        .send({ estado, respuesta: texto });

    const respuestas = await Promise.all([
      atender('respondida', 'Borramos tus datos.'),
      atender('rechazada', 'No corresponde.'),
    ]);

    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);
    const conflicto = respuestas.find((r) => r.status === 409);
    expect(conflicto?.body.error.codigo).toBe('CONFLICTO');
    expect(await auditorias(id)).toHaveLength(1);
    const guardada = await fila(id);
    const ganadora = respuestas.find((r) => r.status === 200);
    expect(guardada?.respuesta).toBe(ganadora?.body.data.respuesta);
  });

  it('una cuenta eliminada se lista sin nombre ni correo y su solicitud se puede atender', async () => {
    const admin = await sesionAdmin();
    const correo = 'beto@ejemplo.cl';
    const beto = await estudiante(correo);
    const id = await solicitud(beto, 'acceso', 3, 27);
    const ingreso = await request(entorno.app)
      .post('/api/v1/app/cuentas/ingreso')
      .send({ correo, contrasena: CONTRASENA });
    const borrado = await request(entorno.app)
      .delete('/api/v1/app/privacidad/cuenta')
      .set('Authorization', `Bearer ${ingreso.body.data.tokenAcceso as string}`);
    expect(borrado.status).toBe(200);

    const lista = await request(entorno.app).get(RUTA).set(admin.conSesion);
    const atendida = await request(entorno.app)
      .patch(`${RUTA}/${id}`)
      .set(admin.conSesion)
      .send({ estado: 'rechazada', respuesta: 'La cuenta ya fue eliminada.' });

    expect(lista.status).toBe(200);
    expect(datos<{ solicitudes: SolicitudHttp[] }>(lista).solicitudes[0]?.estudiante).toEqual({
      id: Number(beto),
      nombre: null,
      correo: null,
      cuentaEliminada: true,
    });
    expect(JSON.stringify(lista.body)).not.toContain(correo);
    expect(atendida.status).toBe(200);
    expect((await fila(id))?.estado).toBe('rechazada');
  });
});
