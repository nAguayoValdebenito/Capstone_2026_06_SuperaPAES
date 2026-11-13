// Solicitudes sobre los datos personales desde la app (HU-09.1, RF-A21, CU-14 3.b, A40), sin
// PostgreSQL: el servicio real de privacidad con el repositorio en memoria. El plazo leído del
// parámetro y que cada estudiante solo vea las suyas contra la base real están en
// solicitudes-derechos-bd.test.ts.
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type {
  FilaSolicitudPropia,
  NuevaSolicitud,
  PrivacidadRepositorio,
} from '../modulos/privacidad/privacidad.repositorio.js';
import { crearPrivacidadServicio } from '../modulos/privacidad/privacidad.servicio.js';
import { crearAppDePrueba, errorConFormato, tokenAdmin, tokenApp } from './ayudantes.js';

const RUTA = '/api/v1/app/privacidad';
const AHORA = new Date('2026-11-12T15:00:00.000Z');
const DIA = 24 * 60 * 60 * 1000;
const PENDIENTE = { codigo: 'pendiente', nombre: 'Pendiente' };
const ACCESO = { codigo: 'acceso', nombre: 'Acceso' };

const TIPOS = [
  { ...ACCESO, descripcion: 'Saber qué datos personales guarda el sistema y recibir una copia.' },
  { codigo: 'rectificacion', nombre: 'Rectificación', descripcion: 'Corregir datos inexactos.' },
];

const fila = (cambios: Partial<FilaSolicitudPropia> = {}): FilaSolicitudPropia => ({
  id: '31',
  tipo: ACCESO,
  detalle: 'Quiero saber qué datos guardan.',
  estado: PENDIENTE,
  solicitadoEn: AHORA,
  venceEn: new Date(AHORA.getTime() + 30 * DIA),
  respondidoEn: null,
  respuesta: null,
  ...cambios,
});

function escenario(plazo = 30) {
  const repositorio = {
    tiposDerecho: vi.fn(() => Promise.resolve(TIPOS)),
    crearSolicitud: vi.fn((nueva: NuevaSolicitud) =>
      Promise.resolve(
        nueva.tipo === 'acceso'
          ? fila({
              detalle: nueva.detalle,
              solicitadoEn: nueva.solicitadoEn,
              venceEn: nueva.venceEn,
            })
          : null,
      ),
    ),
    solicitudesDe: vi.fn(() =>
      Promise.resolve([
        fila({
          id: '32',
          estado: { codigo: 'respondida', nombre: 'Respondida' },
          respondidoEn: new Date('2026-11-13T12:00:00.000Z'),
          respuesta: 'Te enviamos tus datos.',
        }),
        fila(),
      ]),
    ),
    // La bandeja de la consola (HU-55.1) no se usa aquí: ver solicitudes-consola.test.ts.
    listarSolicitudes: vi.fn(() => Promise.resolve({ filas: [], total: 0 })),
    contarPendientes: vi.fn(() => Promise.resolve(0)),
    solicitud: vi.fn(() => Promise.resolve(null)),
    reservarSolicitud: vi.fn(() => Promise.resolve(null)),
    responderSolicitud: vi.fn(() => Promise.resolve()),
  } satisfies PrivacidadRepositorio;
  const administracion = {
    obtenerParametroEntero: vi.fn(() => Promise.resolve(plazo)),
    registrarAuditoria: vi.fn(() => Promise.resolve()),
  };
  const sinBase = () => Promise.reject(new Error('sin base'));
  const privacidad = crearPrivacidadServicio({
    bd: { query: sinBase },
    unidadDeTrabajo: { enTransaccion: sinBase },
    cuentas: {} as never,
    evaluaciones: { exportarEvaluaciones: sinBase },
    suscripciones: { vigenteDe: sinBase },
    administracion,
    reloj: () => new Date(AHORA),
    repositorio,
  });
  const app = crearAppDePrueba({}, { privacidad });
  return { app, repositorio, administracion };
}

const comoEstudiante = async (id = '10') => ({ Authorization: `Bearer ${await tokenApp(id)}` });

describe('tipos de solicitud (A40)', () => {
  it('entrega los derechos de la Ley 21.719 con su explicación, por código', async () => {
    const { app } = escenario();

    const respuesta = await request(app)
      .get(`${RUTA}/tipos-derecho`)
      .set(await comoEstudiante());

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ data: TIPOS, error: null, meta: null });
  });
});

describe('enviar una solicitud (HU-09 esc. 1)', () => {
  it('queda pendiente, con la fecha límite del parámetro plazo_derechos_dias', async () => {
    const { app, repositorio, administracion } = escenario();

    const respuesta = await request(app)
      .post(`${RUTA}/solicitudes`)
      .set(await comoEstudiante())
      .send({ tipo: 'acceso', detalle: '  Quiero saber qué datos guardan.  ' });

    expect(respuesta.status).toBe(201);
    expect(administracion.obtenerParametroEntero).toHaveBeenCalledWith('plazo_derechos_dias');
    expect(repositorio.crearSolicitud).toHaveBeenCalledWith({
      estudianteId: '10',
      tipo: 'acceso',
      detalle: 'Quiero saber qué datos guardan.',
      solicitadoEn: AHORA,
      venceEn: new Date('2026-12-12T15:00:00.000Z'),
    });
    expect(respuesta.body.data).toEqual({
      id: 31,
      tipo: ACCESO,
      detalle: 'Quiero saber qué datos guardan.',
      estado: PENDIENTE,
      solicitadoEn: '2026-11-12T15:00:00.000Z',
      venceEn: '2026-12-12T15:00:00.000Z',
      respondidoEn: null,
      respuesta: null,
    });
  });

  it('usa el plazo vigente del parámetro, no un valor fijo', async () => {
    const { app, repositorio } = escenario(10);

    await request(app)
      .post(`${RUTA}/solicitudes`)
      .set(await comoEstudiante())
      .send({ tipo: 'acceso' });

    expect(repositorio.crearSolicitud).toHaveBeenCalledWith(
      expect.objectContaining({ venceEn: new Date('2026-11-22T15:00:00.000Z') }),
    );
  });

  it.each([
    ['sin detalle', {}],
    ['con detalle vacío', { detalle: '   ' }],
    ['con detalle nulo', { detalle: null }],
  ])('el detalle es opcional (modelo 11.0): %s se guarda como null', async (_caso, cuerpo) => {
    const { app, repositorio } = escenario();

    const respuesta = await request(app)
      .post(`${RUTA}/solicitudes`)
      .set(await comoEstudiante())
      .send({ tipo: 'acceso', ...cuerpo });

    expect(respuesta.status).toBe(201);
    expect(repositorio.crearSolicitud).toHaveBeenCalledWith(
      expect.objectContaining({ detalle: null }),
    );
  });

  it('acepta un detalle de 2.000 caracteres y rechaza uno más largo', async () => {
    const { app, repositorio } = escenario();
    const enviar = async (detalle: string) =>
      request(app)
        .post(`${RUTA}/solicitudes`)
        .set(await comoEstudiante())
        .send({ tipo: 'acceso', detalle });

    expect((await enviar('a'.repeat(2000))).status).toBe(201);
    const largo = await enviar('a'.repeat(2001));

    expect(largo.status).toBe(400);
    expect(largo.body).toMatchObject(errorConFormato('VALIDACION'));
    expect(repositorio.crearSolicitud).toHaveBeenCalledTimes(1);
  });

  it('un tipo que no está en contenido.tipo_derecho da 400 y no guarda nada', async () => {
    const { app } = escenario();

    const respuesta = await request(app)
      .post(`${RUTA}/solicitudes`)
      .set(await comoEstudiante())
      .send({ tipo: 'olvido' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toMatchObject(errorConFormato('VALIDACION'));
  });

  it.each([
    ['sin tipo', { detalle: 'Hola' }],
    ['tipo que no es texto', { tipo: 3 }],
    ['campo desconocido', { tipo: 'acceso', estudianteId: 99 }],
  ])('%s da 400 sin llegar al servicio', async (_caso, cuerpo) => {
    const { app, repositorio, administracion } = escenario();

    const respuesta = await request(app)
      .post(`${RUTA}/solicitudes`)
      .set(await comoEstudiante())
      .send(cuerpo);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toMatchObject(errorConFormato('VALIDACION'));
    expect(administracion.obtenerParametroEntero).not.toHaveBeenCalled();
    expect(repositorio.crearSolicitud).not.toHaveBeenCalled();
  });
});

describe('ver mis solicitudes (HU-09 esc. 2)', () => {
  it('lista solo las del estudiante de la sesión, con su estado y su respuesta', async () => {
    const { app, repositorio } = escenario();

    const respuesta = await request(app)
      .get(`${RUTA}/solicitudes`)
      .set(await comoEstudiante('77'));

    expect(respuesta.status).toBe(200);
    expect(repositorio.solicitudesDe).toHaveBeenCalledWith('77');
    expect(respuesta.body.data[0]).toEqual({
      id: 32,
      tipo: ACCESO,
      detalle: 'Quiero saber qué datos guardan.',
      estado: { codigo: 'respondida', nombre: 'Respondida' },
      solicitadoEn: '2026-11-12T15:00:00.000Z',
      venceEn: '2026-12-12T15:00:00.000Z',
      respondidoEn: '2026-11-13T12:00:00.000Z',
      respuesta: 'Te enviamos tus datos.',
    });
    expect(respuesta.body.data[1].id).toBe(31);
  });
});

describe('sesión', () => {
  it.each([
    ['GET', '/tipos-derecho'],
    ['GET', '/solicitudes'],
    ['POST', '/solicitudes'],
  ])('%s %s sin token da 401', async (metodo, ruta) => {
    const { app } = escenario();
    const peticion =
      metodo === 'GET' ? request(app).get(RUTA + ruta) : request(app).post(RUTA + ruta);

    const respuesta = await peticion.send(metodo === 'POST' ? { tipo: 'acceso' } : undefined);

    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toMatchObject(errorConFormato('NO_AUTENTICADO'));
  });

  it('el token de la consola no sirve en la app', async () => {
    const { app, repositorio } = escenario();

    const respuesta = await request(app)
      .post(`${RUTA}/solicitudes`)
      .set({ Authorization: `Bearer ${await tokenAdmin()}` })
      .send({ tipo: 'acceso' });

    expect(respuesta.status).toBe(401);
    expect(repositorio.crearSolicitud).not.toHaveBeenCalled();
  });
});
