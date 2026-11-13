// Bandeja y respuesta de las solicitudes de datos en la consola (HU-55.1, RF-C10, C14), sin
// PostgreSQL: el servicio real de privacidad con el repositorio en memoria. El orden, la respuesta con
// su auditoría en una transacción, la concurrencia y las cuentas eliminadas contra la base real están
// en solicitudes-consola-bd.test.ts.
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { Ejecutor } from '../db/transaccion.js';
import type {
  FilaSolicitudConsola,
  PrivacidadRepositorio,
} from '../modulos/privacidad/privacidad.repositorio.js';
import { crearPrivacidadServicio } from '../modulos/privacidad/privacidad.servicio.js';
import { crearAppDePrueba, errorConFormato, tokenAdmin, tokenApp } from './ayudantes.js';

const RUTA = '/api/v1/admin/privacidad/solicitudes';
/** 12/11/2026 a las 12:00 de Chile (UTC-3 en noviembre). */
const AHORA = new Date('2026-11-12T15:00:00.000Z');
const PENDIENTE = { codigo: 'pendiente', nombre: 'Pendiente' };
const RESPONDIDA = { codigo: 'respondida', nombre: 'Respondida' };
const ACCESO = { codigo: 'acceso', nombre: 'Acceso' };
const ANA = { id: '84', nombre: 'Ana', correo: 'ana@ejemplo.cl', cuentaEliminada: false };

const fila = (id: string, cambios: Partial<FilaSolicitudConsola> = {}): FilaSolicitudConsola => ({
  id,
  tipo: ACCESO,
  detalle: 'Quiero una copia de mis datos.',
  estado: PENDIENTE,
  solicitadoEn: new Date('2026-10-11T15:00:00.000Z'),
  venceEn: new Date('2026-11-10T15:00:00.000Z'),
  respondidoEn: null,
  respuesta: null,
  atendidoPor: null,
  estudiante: ANA,
  ...cambios,
});

/** 31 venció hace 2 días; 32 vence el 14/11 a las 23:00 de Chile (15/11 en UTC): faltan 2 días. */
const VENCIDA = fila('31');
const A_TIEMPO = fila('32', { venceEn: new Date('2026-11-15T02:00:00.000Z') });

function escenario() {
  const estados: Record<string, { estado: typeof PENDIENTE; final: boolean }> = {
    '31': { estado: PENDIENTE, final: false },
    '33': { estado: RESPONDIDA, final: true },
  };
  const tx: Ejecutor = { query: () => Promise.reject(new Error('sin base')) };
  const repositorio = {
    tiposDerecho: vi.fn(() => Promise.resolve([])),
    crearSolicitud: vi.fn(() => Promise.resolve(null)),
    solicitudesDe: vi.fn(() => Promise.resolve([])),
    listarSolicitudes: vi.fn(() => Promise.resolve({ filas: [VENCIDA, A_TIEMPO], total: 2 })),
    contarPendientes: vi.fn(() => Promise.resolve(2)),
    solicitud: vi.fn((id: string) =>
      Promise.resolve(
        id === '31'
          ? fila('31', {
              estado: RESPONDIDA,
              respondidoEn: AHORA,
              respuesta: 'Te enviamos la copia.',
              atendidoPor: { id: '1', nombre: 'Ana Admin' },
            })
          : null,
      ),
    ),
    reservarSolicitud: vi.fn((id: string) => Promise.resolve(estados[id] ?? null)),
    responderSolicitud: vi.fn(() => Promise.resolve()),
  } satisfies PrivacidadRepositorio;
  const administracion = {
    obtenerParametroEntero: vi.fn(() => Promise.resolve(30)),
    registrarAuditoria: vi.fn(() => Promise.resolve()),
  };
  const sinBase = () => Promise.reject(new Error('sin base'));
  const privacidad = crearPrivacidadServicio({
    bd: tx,
    unidadDeTrabajo: { enTransaccion: (trabajo) => trabajo(tx) },
    cuentas: {} as never,
    evaluaciones: { exportarEvaluaciones: sinBase },
    suscripciones: { vigenteDe: sinBase },
    administracion,
    reloj: () => new Date(AHORA),
    repositorio,
  });
  const app = crearAppDePrueba({}, { privacidad });
  return { app, repositorio, administracion, tx };
}

const comoAdmin = async (rol: 'admin' | 'docente' = 'admin') => ({
  Authorization: `Bearer ${await tokenAdmin(rol)}`,
});

describe('bandeja de solicitudes (HU-55 esc. 1)', () => {
  it('por defecto lista las pendientes, con el plazo calculado y el total de pendientes', async () => {
    const { app, repositorio } = escenario();

    const respuesta = await request(app)
      .get(RUTA)
      .set(await comoAdmin());

    expect(respuesta.status).toBe(200);
    expect(repositorio.listarSolicitudes).toHaveBeenCalledWith({
      estado: 'pendiente',
      limite: 20,
      desde: 0,
    });
    expect(respuesta.body.meta).toEqual({ pagina: 1, porPagina: 20, total: 2 });
    expect(respuesta.body.data.pendientes).toBe(2);
    expect(respuesta.body.data.solicitudes[0]).toEqual({
      id: 31,
      tipo: ACCESO,
      detalle: 'Quiero una copia de mis datos.',
      estado: PENDIENTE,
      solicitadoEn: '2026-10-11T15:00:00.000Z',
      venceEn: '2026-11-10T15:00:00.000Z',
      diasRestantes: -2,
      vencida: true,
      respondidoEn: null,
      respuesta: null,
      atendidoPor: null,
      estudiante: { ...ANA, id: 84 },
    });
    expect(respuesta.body.data.solicitudes[1]).toMatchObject({
      id: 32,
      diasRestantes: 2,
      vencida: false,
    });
  });

  it('filtra por estado y pagina; una atendida no tiene plazo pendiente', async () => {
    const { app, repositorio } = escenario();
    repositorio.listarSolicitudes.mockResolvedValueOnce({
      filas: [fila('33', { estado: RESPONDIDA, respondidoEn: AHORA, respuesta: 'Listo.' })],
      total: 11,
    });

    const respuesta = await request(app)
      .get(`${RUTA}?estado=respondida&pagina=2&porPagina=10`)
      .set(await comoAdmin());

    expect(respuesta.status).toBe(200);
    expect(repositorio.listarSolicitudes).toHaveBeenCalledWith({
      estado: 'respondida',
      limite: 10,
      desde: 10,
    });
    expect(respuesta.body.meta).toEqual({ pagina: 2, porPagina: 10, total: 11 });
    expect(respuesta.body.data.solicitudes[0]).toMatchObject({
      estado: RESPONDIDA,
      diasRestantes: null,
      vencida: false,
    });
  });

  it('una cuenta eliminada se lista sin nombre ni correo (RNF-09)', async () => {
    const { app, repositorio } = escenario();
    const eliminada = { id: '90', nombre: null, correo: null, cuentaEliminada: true };
    repositorio.listarSolicitudes.mockResolvedValueOnce({
      filas: [fila('34', { estudiante: eliminada })],
      total: 1,
    });

    const respuesta = await request(app)
      .get(RUTA)
      .set(await comoAdmin());

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.solicitudes[0].estudiante).toEqual({ ...eliminada, id: 90 });
  });

  it.each([['estado=todas'], ['estado=PENDIENTE'], ['pagina=0'], ['porPagina=500'], ['otro=1']])(
    'una consulta inválida (%s) da 400',
    async (consulta) => {
      const { app, repositorio } = escenario();

      const respuesta = await request(app)
        .get(`${RUTA}?${consulta}`)
        .set(await comoAdmin());

      expect(respuesta.status).toBe(400);
      expect(respuesta.body).toMatchObject(errorConFormato('VALIDACION'));
      expect(repositorio.listarSolicitudes).not.toHaveBeenCalled();
    },
  );
});

describe('ver una solicitud', () => {
  it('entrega la solicitud con quién la atendió', async () => {
    const { app } = escenario();

    const respuesta = await request(app)
      .get(`${RUTA}/31`)
      .set(await comoAdmin());

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      id: 31,
      estado: RESPONDIDA,
      atendidoPor: { id: 1, nombre: 'Ana Admin' },
      diasRestantes: null,
      vencida: false,
    });
  });

  it('una solicitud inexistente da 404 y un id inválido 400', async () => {
    const { app } = escenario();

    const inexistente = await request(app)
      .get(`${RUTA}/999`)
      .set(await comoAdmin());
    const invalido = await request(app)
      .get(`${RUTA}/abc`)
      .set(await comoAdmin());

    expect(inexistente.status).toBe(404);
    expect(inexistente.body).toMatchObject(errorConFormato('NO_ENCONTRADO'));
    expect(invalido.status).toBe(400);
  });
});

describe('responder o rechazar (HU-55 esc. 2)', () => {
  it.each(['respondida', 'rechazada'])(
    'guarda %s con el texto, la fecha y quién la atendió, y la auditoría en la misma transacción',
    async (estado) => {
      const { app, repositorio, administracion, tx } = escenario();

      const respuesta = await request(app)
        .patch(`${RUTA}/31`)
        .set(await comoAdmin())
        .send({ estado, respuesta: '  Te enviamos la copia.  ' });

      expect(respuesta.status).toBe(200);
      expect(repositorio.reservarSolicitud).toHaveBeenCalledWith('31', tx);
      expect(repositorio.responderSolicitud).toHaveBeenCalledWith(
        '31',
        { estado, respuesta: 'Te enviamos la copia.', respondidoEn: AHORA, atendidoPor: '1' },
        tx,
      );
      expect(administracion.registrarAuditoria).toHaveBeenCalledWith(
        {
          usuarioId: '1',
          accion: 'responder_solicitud',
          entidad: 'solicitud_derecho',
          entidadId: '31',
          antes: { estado: 'pendiente' },
          despues: { estado, respondidoEn: AHORA.toISOString(), atendidoPor: '1' },
        },
        tx,
      );
      expect(repositorio.solicitud).toHaveBeenCalledWith('31', tx);
      expect(respuesta.body.data).toMatchObject({ id: 31, atendidoPor: { id: 1 } });
    },
  );

  it('la auditoría no guarda el texto de la respuesta (plan HU-55, D4)', async () => {
    const { app, administracion } = escenario();

    await request(app)
      .patch(`${RUTA}/31`)
      .set(await comoAdmin())
      .send({ estado: 'respondida', respuesta: 'Texto con datos personales.' });

    expect(JSON.stringify(administracion.registrarAuditoria.mock.calls)).not.toContain(
      'datos personales',
    );
  });

  it.each([
    ['sin respuesta', { estado: 'respondida' }],
    ['respuesta vacía', { estado: 'respondida', respuesta: '   ' }],
    ['respuesta de más de 2.000 caracteres', { estado: 'rechazada', respuesta: 'a'.repeat(2001) }],
    ['estado pendiente', { estado: 'pendiente', respuesta: 'Hola' }],
    ['campo desconocido', { estado: 'respondida', respuesta: 'Hola', atendidoPor: 3 }],
  ])('%s da 400 sin tocar la solicitud', async (_caso, cuerpo) => {
    const { app, repositorio } = escenario();

    const respuesta = await request(app)
      .patch(`${RUTA}/31`)
      .set(await comoAdmin())
      .send(cuerpo);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toMatchObject(errorConFormato('VALIDACION'));
    expect(repositorio.reservarSolicitud).not.toHaveBeenCalled();
  });

  it('una solicitud ya atendida da 409 y no se vuelve a responder', async () => {
    const { app, repositorio, administracion } = escenario();

    const respuesta = await request(app)
      .patch(`${RUTA}/33`)
      .set(await comoAdmin())
      .send({ estado: 'rechazada', respuesta: 'No corresponde.' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toMatchObject(errorConFormato('CONFLICTO'));
    expect(respuesta.body.error.mensaje).toBe('La solicitud ya está «Respondida».');
    expect(repositorio.responderSolicitud).not.toHaveBeenCalled();
    expect(administracion.registrarAuditoria).not.toHaveBeenCalled();
  });

  it('una solicitud inexistente da 404', async () => {
    const { app, repositorio } = escenario();

    const respuesta = await request(app)
      .patch(`${RUTA}/999`)
      .set(await comoAdmin())
      .send({ estado: 'respondida', respuesta: 'Listo.' });

    expect(respuesta.status).toBe(404);
    expect(repositorio.responderSolicitud).not.toHaveBeenCalled();
  });
});

describe('permisos', () => {
  it.each([
    ['GET', RUTA],
    ['GET', `${RUTA}/31`],
    ['PATCH', `${RUTA}/31`],
  ])('%s %s: el docente recibe 403', async (metodo, ruta) => {
    const { app, repositorio } = escenario();
    const peticion = metodo === 'GET' ? request(app).get(ruta) : request(app).patch(ruta);

    const respuesta = await peticion
      .set(await comoAdmin('docente'))
      .send(metodo === 'PATCH' ? { estado: 'respondida', respuesta: 'Listo.' } : undefined);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body).toMatchObject(errorConFormato('SIN_PERMISO'));
    expect(repositorio.responderSolicitud).not.toHaveBeenCalled();
  });

  it('el token de la app y la falta de token dan 401', async () => {
    const { app } = escenario();

    const conTokenApp = await request(app)
      .get(RUTA)
      .set({ Authorization: `Bearer ${await tokenApp()}` });
    const sinToken = await request(app).get(RUTA);

    expect(conTokenApp.status).toBe(401);
    expect(sinToken.status).toBe(401);
  });
});
