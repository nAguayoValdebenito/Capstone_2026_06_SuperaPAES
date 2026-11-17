// TEC-07: las rutas públicas responden los errores de validación en español, con el formato de la API,
// y nunca con el mensaje por defecto de zod en inglés (por ejemplo, la contraseña vacía del ingreso).
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearEscenarioSesiones } from './escenario-sesiones.js';

const PUBLICAS_POST = [
  '/api/v1/app/cuentas/registro',
  '/api/v1/app/cuentas/ingreso',
  '/api/v1/app/cuentas/recuperacion/solicitar',
  '/api/v1/app/cuentas/recuperacion/restablecer',
  '/api/v1/app/cuentas/verificacion/enlace',
  '/api/v1/app/cuentas/renovar',
  '/api/v1/app/cuentas/cerrar',
  '/api/v1/admin/cuentas/ingreso',
  '/api/v1/admin/cuentas/renovar',
  '/api/v1/admin/cuentas/cerrar',
];

const CUERPOS_INVALIDOS: [string, unknown][] = [
  ['vacío', {}],
  ['con textos vacíos', { correo: '', contrasena: '', token: '', tokenRenovacion: '' }],
  ['con tipos equivocados', { correo: 1, contrasena: 2, token: 3, tokenRenovacion: 4, nombre: 5 }],
  ['con campos que no existen', { correo: 'ana@ejemplo.cl', contrasena: 'x', campoInventado: 1 }],
  ['con un texto demasiado largo', { correo: 'a'.repeat(300), token: 'a'.repeat(300) }],
];

/** Palabras del mensaje por defecto de zod (en inglés) que no deben llegar al cliente. */
const INGLES =
  /\b(invalid|expected|received|too (small|big)|unrecognized|required|must|string|characters?|input)\b/i;

interface Problema {
  lugar: string;
  ruta: string;
  mensaje: string;
}

describe('validación en español de las rutas públicas', () => {
  const { app } = crearEscenarioSesiones();

  describe.each(PUBLICAS_POST)('POST %s', (ruta) => {
    it.each(CUERPOS_INVALIDOS)(
      'cuerpo %s: 400 VALIDACION sin mensajes en inglés',
      async (_c, cuerpo) => {
        const respuesta = await request(app)
          .post(ruta)
          .send(cuerpo as object);

        expect(respuesta.status).toBe(400);
        expect(respuesta.body.error.codigo).toBe('VALIDACION');
        expect(respuesta.body.data).toBeNull();
        const detalles = respuesta.body.error.detalles as Problema[];
        expect(detalles.length).toBeGreaterThan(0);
        for (const { mensaje } of detalles) {
          expect(mensaje, `${ruta}: «${mensaje}»`).not.toMatch(INGLES);
          expect(mensaje.length).toBeGreaterThan(0);
        }
      },
    );
  });

  it('ingreso con la contraseña vacía: «Ingresa tu contraseña.»', async () => {
    const respuesta = await request(app)
      .post('/api/v1/app/cuentas/ingreso')
      .send({ correo: 'ana@ejemplo.cl', contrasena: '' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles).toEqual([
      { lugar: 'cuerpo', ruta: 'contrasena', mensaje: 'Ingresa tu contraseña.' },
    ]);
  });

  it('ingreso sin correo ni contraseña: pide los dos', async () => {
    for (const ruta of ['/api/v1/app/cuentas/ingreso', '/api/v1/admin/cuentas/ingreso']) {
      const respuesta = await request(app).post(ruta).send({});
      expect(respuesta.body.error.detalles).toEqual([
        { lugar: 'cuerpo', ruta: 'correo', mensaje: 'Ingresa tu correo.' },
        { lugar: 'cuerpo', ruta: 'contrasena', mensaje: 'Ingresa tu contraseña.' },
      ]);
    }
  });

  it.each([
    ['/api/v1/app/cuentas/renovar', 'tokenRenovacion'],
    ['/api/v1/app/cuentas/verificacion/enlace', 'token'],
    ['/api/v1/app/cuentas/recuperacion/restablecer', 'token'],
  ])('%s sin %s: pide el dato en español', async (ruta, campo) => {
    const respuesta = await request(app).post(ruta).send({});
    const detalle = (respuesta.body.error.detalles as Problema[]).find((d) => d.ruta === campo);
    expect(detalle?.mensaje).toBe('Falta un dato obligatorio.');
  });

  it('un campo que no existe se informa en español', async () => {
    const respuesta = await request(app)
      .post('/api/v1/app/cuentas/ingreso')
      .send({ correo: 'ana@ejemplo.cl', contrasena: 'clave-larga-12', campoInventado: 1 });

    expect(respuesta.status).toBe(400);
    expect((respuesta.body.error.detalles as Problema[])[0]?.mensaje).toBe(
      'Hay un dato que no corresponde a este formulario.',
    );
  });
});
