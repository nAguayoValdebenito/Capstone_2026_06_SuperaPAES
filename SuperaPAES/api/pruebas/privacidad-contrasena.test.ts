// Descargar mis datos (HU-07.1) y borrar la cuenta (HU-08.1) piden la contraseña del estudiante, sin
// PostgreSQL: el servicio real de privacidad sobre un servicio de cuentas falso. La contraseña
// incorrecta responde 401 sin exportar ni borrar nada, y el sexto intento fallido en 15 minutos se
// corta. La comprobación real de la contraseña (bcrypt, cuenta eliminada) es la del servicio de
// cuentas, al final de este archivo. Contra la base: exportacion-bd.test.ts y borrar-cuenta-bd.test.ts.
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { ErrorNoAutenticado } from '../comun/errores.js';
import { crearConfirmacionContrasena } from '../modulos/cuentas/cuentas.credenciales.js';
import type { CuentasServicio } from '../modulos/cuentas/index.js';
import { crearPrivacidadServicio } from '../modulos/privacidad/privacidad.servicio.js';
import { crearAppDePrueba, errorConFormato, tokenApp } from './ayudantes.js';
import { hashDeContrasena } from './estudiantes-de-prueba.js';

const RUTA_MIS_DATOS = '/api/v1/app/privacidad/mis-datos';
const RUTA_CUENTA = '/api/v1/app/privacidad/cuenta';
const CORRECTA = 'clave-para-practicar';
const INCORRECTA = 'otra-clave-cualquiera';
const AHORA = new Date('2026-11-15T12:00:00.000Z');

function escenario() {
  const cuentas = {
    confirmarContrasenaEstudiante: vi.fn((_id: string, contrasena: string) =>
      contrasena === CORRECTA
        ? Promise.resolve()
        : Promise.reject(new ErrorNoAutenticado('La contraseña no es correcta.')),
    ),
    exportarCuenta: vi.fn(() => Promise.resolve({ cuenta: { id: '10' }, documentosAceptados: [] })),
    obtenerPerfil: vi.fn(() => Promise.resolve({ pruebas: [] })),
    obtenerPuntajes: vi.fn(() => Promise.resolve({ puntajes: [] })),
    eliminarCuenta: vi.fn(() => Promise.resolve({ eliminadaEn: AHORA })),
  };
  const evaluaciones = { exportarEvaluaciones: vi.fn(() => Promise.resolve([])) };
  const sinBase = () => Promise.reject(new Error('sin base'));
  const privacidad = crearPrivacidadServicio({
    bd: { query: sinBase },
    unidadDeTrabajo: { enTransaccion: sinBase },
    cuentas: cuentas as unknown as CuentasServicio,
    evaluaciones,
    suscripciones: { vigenteDe: sinBase },
    administracion: { obtenerParametroEntero: sinBase, registrarAuditoria: sinBase },
    reloj: () => new Date(AHORA),
  });
  const app = crearAppDePrueba({}, { privacidad });
  return { app, cuentas, evaluaciones };
}

const comoEstudiante = async (id = '10') => ({ Authorization: `Bearer ${await tokenApp(id)}` });

describe('descargar mis datos pide la contraseña (HU-07.1)', () => {
  it('con la contraseña correcta entrega el archivo, sin guardarlo en caché', async () => {
    const { app, cuentas } = escenario();

    const respuesta = await request(app)
      .post(RUTA_MIS_DATOS)
      .set(await comoEstudiante())
      .send({ contrasena: CORRECTA });

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['cache-control']).toBe('no-store');
    // El contrato de ids convierte data.cuenta.id en número también en la ruta POST.
    expect(respuesta.body.data.cuenta).toEqual({ id: 10 });
    expect(cuentas.confirmarContrasenaEstudiante).toHaveBeenCalledWith('10', CORRECTA);
  });

  it('con la contraseña incorrecta responde 401 y no lee ningún dato', async () => {
    const { app, cuentas, evaluaciones } = escenario();

    const respuesta = await request(app)
      .post(RUTA_MIS_DATOS)
      .set(await comoEstudiante())
      .send({ contrasena: INCORRECTA });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual(errorConFormato('NO_AUTENTICADO'));
    expect(respuesta.body.error.mensaje).toBe('La contraseña no es correcta.');
    expect(cuentas.exportarCuenta).not.toHaveBeenCalled();
    expect(cuentas.obtenerPerfil).not.toHaveBeenCalled();
    expect(evaluaciones.exportarEvaluaciones).not.toHaveBeenCalled();
  });

  it('ya no responde por GET: solo el token no basta', async () => {
    const { app, cuentas } = escenario();

    const respuesta = await request(app)
      .get(RUTA_MIS_DATOS)
      .set(await comoEstudiante());

    expect(respuesta.status).toBe(404);
    expect(cuentas.exportarCuenta).not.toHaveBeenCalled();
  });
});

describe('borrar la cuenta pide la contraseña (HU-08.1)', () => {
  it('con la contraseña correcta borra la cuenta', async () => {
    const { app, cuentas } = escenario();

    const respuesta = await request(app)
      .delete(RUTA_CUENTA)
      .set(await comoEstudiante())
      .send({ contrasena: CORRECTA });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({ eliminadaEn: AHORA.toISOString() });
    expect(cuentas.eliminarCuenta).toHaveBeenCalledWith('10');
  });

  it('con la contraseña incorrecta responde 401 y no borra nada', async () => {
    const { app, cuentas } = escenario();

    const respuesta = await request(app)
      .delete(RUTA_CUENTA)
      .set(await comoEstudiante())
      .send({ contrasena: INCORRECTA });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.mensaje).toBe('La contraseña no es correcta.');
    expect(cuentas.eliminarCuenta).not.toHaveBeenCalled();
  });
});

describe('cuerpo de la confirmación', () => {
  it.each([
    ['sin cuerpo', undefined],
    ['sin contraseña', {}],
    ['contraseña vacía', { contrasena: '' }],
    ['más de 72 bytes', { contrasena: 'ñ'.repeat(37) }],
    ['un campo de más', { contrasena: CORRECTA, otro: 1 }],
  ])('%s: 400 VALIDACION, sin comprobar ni borrar', async (_caso, cuerpo) => {
    const { app, cuentas } = escenario();

    const respuesta = await request(app)
      .delete(RUTA_CUENTA)
      .set(await comoEstudiante())
      .send(cuerpo);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
    expect(cuentas.confirmarContrasenaEstudiante).not.toHaveBeenCalled();
    expect(cuentas.eliminarCuenta).not.toHaveBeenCalled();
  });
});

describe('límite de contraseñas incorrectas (5 por estudiante en 15 minutos)', () => {
  it('el sexto intento fallido se corta con 429, aunque traiga la contraseña correcta', async () => {
    const { app, cuentas } = escenario();
    const conSesion = await comoEstudiante();
    const estados: number[] = [];

    // Las dos rutas comparten el contador: probar en una gasta los intentos de la otra.
    for (const ruta of [RUTA_CUENTA, RUTA_MIS_DATOS, RUTA_CUENTA, RUTA_MIS_DATOS, RUTA_CUENTA]) {
      const peticion = ruta === RUTA_CUENTA ? request(app).delete(ruta) : request(app).post(ruta);
      const fallido = await peticion.set(conSesion).send({ contrasena: INCORRECTA });
      estados.push(fallido.status);
    }
    const sexto = await request(app)
      .delete(RUTA_CUENTA)
      .set(conSesion)
      .send({ contrasena: CORRECTA });

    expect(estados).toEqual([401, 401, 401, 401, 401]);
    expect(sexto.status).toBe(429);
    expect(sexto.body).toEqual(errorConFormato('DEMASIADOS_INTENTOS'));
    expect(cuentas.confirmarContrasenaEstudiante).toHaveBeenCalledTimes(5);
    expect(cuentas.eliminarCuenta).not.toHaveBeenCalled();
  });

  it('los intentos correctos no cuentan y cada estudiante tiene su propio contador', async () => {
    const { app } = escenario();
    const ana = await comoEstudiante('10');
    const beto = await comoEstudiante('11');

    for (let i = 0; i < 6; i++) {
      const correcta = await request(app)
        .post(RUTA_MIS_DATOS)
        .set(ana)
        .send({ contrasena: CORRECTA });
      expect(correcta.status).toBe(200);
    }
    for (let i = 0; i < 5; i++) {
      await request(app).post(RUTA_MIS_DATOS).set(ana).send({ contrasena: INCORRECTA });
    }
    const deBeto = await request(app).post(RUTA_MIS_DATOS).set(beto).send({ contrasena: CORRECTA });
    const deAna = await request(app).post(RUTA_MIS_DATOS).set(ana).send({ contrasena: CORRECTA });

    expect(deBeto.status).toBe(200);
    expect(deAna.status).toBe(429);
  });
});

describe('cuentas confirma la contraseña del estudiante', () => {
  it('correcta: termina sin error; incorrecta o cuenta eliminada: 401 con su mensaje', async () => {
    const hashContrasena = await hashDeContrasena(CORRECTA);
    const buscarHash = vi.fn((id: string) =>
      Promise.resolve(id === '10' ? { hashContrasena } : null),
    );
    const confirmacion = crearConfirmacionContrasena(buscarHash);
    const rechazo = { estadoHttp: 401, message: 'La contraseña no es correcta.' };

    await expect(
      confirmacion.confirmarContrasenaEstudiante('10', CORRECTA),
    ).resolves.toBeUndefined();
    await expect(
      confirmacion.confirmarContrasenaEstudiante('10', INCORRECTA),
    ).rejects.toMatchObject(rechazo);
    // Cuenta eliminada (el repositorio no la encuentra): el mismo rechazo, también con bcrypt.
    await expect(confirmacion.confirmarContrasenaEstudiante('11', CORRECTA)).rejects.toMatchObject(
      rechazo,
    );
    expect(buscarHash).toHaveBeenCalledTimes(3);
  });

  it('un error de la base no se disfraza de contraseña incorrecta', async () => {
    const falla = new Error('sin conexión');
    const confirmacion = crearConfirmacionContrasena(() => Promise.reject(falla));

    await expect(confirmacion.confirmarContrasenaEstudiante('10', CORRECTA)).rejects.toBe(falla);
  });
});
