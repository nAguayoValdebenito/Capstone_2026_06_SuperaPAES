// Integración de los dos flujos de correo con el adaptador SMTP real y un servidor local falso.
import { once } from 'node:events';
import { readdir } from 'node:fs/promises';
import { createServer, type AddressInfo } from 'node:net';
import path from 'node:path';
import type { Express } from 'express';
import { simpleParser, type ParsedMail } from 'mailparser';
import request from 'supertest';
import { SMTPServer } from 'smtp-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProveedorCorreoSmtp } from '../adaptadores/correo/smtp.js';
import { ejecutarSemillas } from '../db/semillas.js';
import { usarBaseDeSesiones } from './base-sesiones.js';
import { exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';

const CARPETA_SEMILLAS = path.join(import.meta.dirname, '../db/semillas');

describe('correo SMTP de cuentas sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('correo SMTP de cuentas con PostgreSQL', () => {
  const entorno = usarBaseDeSesiones('smtp_cuentas');
  const recibidos: ParsedMail[] = [];
  let anunciarDatos: () => void = () => undefined;
  let antesDeAceptar = Promise.resolve();
  const smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ['STARTTLS'],
    onData(flujo, _sesion, terminar) {
      anunciarDatos();
      void simpleParser(flujo).then(
        async (correo) => {
          await antesDeAceptar;
          recibidos.push(correo);
          terminar();
        },
        (error: Error) => terminar(error),
      );
    },
  });
  let app: Express;
  let documentosVigentes: number[] = [];

  beforeAll(async () => {
    const tcp = smtp.listen(0, '127.0.0.1');
    await once(tcp, 'listening');
    const puerto = (tcp.address() as AddressInfo).port;
    const todas = (await readdir(CARPETA_SEMILLAS)).filter((nombre) => nombre.endsWith('.sql'));
    await ejecutarSemillas(
      entorno.bd,
      CARPETA_SEMILLAS,
      todas.filter((nombre) => nombre !== '003_documentos_legales.sql'),
    );
    const { rows } = await entorno.bd.query<{ id: number }>(
      `SELECT d.id FROM contenido.documento_legal d
         JOIN contenido.tipo_documento_legal t ON t.id = d.tipo_documento_legal_id
        WHERE t.obligatorio ORDER BY d.id`,
    );
    documentosVigentes = rows.map((fila) => fila.id);
    app = entorno.crearAppConCorreo(
      new ProveedorCorreoSmtp({
        host: '127.0.0.1',
        puerto,
        tls: 'none',
        usuario: undefined,
        clave: undefined,
        remitente: 'no-responder@ejemplo.cl',
        timeoutMs: 2_000,
      }),
    );
  }, MINUTO);

  afterAll(async () => {
    await new Promise<void>((resolver) => smtp.close(() => resolver()));
  });

  beforeEach(() => {
    recibidos.length = 0;
    anunciarDatos = () => undefined;
    antesDeAceptar = Promise.resolve();
  });

  const cuerpoRegistro = (correo: string) => ({
    nombre: 'Estudiante SMTP',
    correo,
    contrasena: 'tranquilo-del-sur',
    declaraTenerCatorceAnios: true,
    documentosAceptados: documentosVigentes,
  });

  it('responde el registro antes de que un SMTP lento termine el envío', async () => {
    let datosIniciados!: () => void;
    const inicioDatos = new Promise<void>((resolver) => {
      datosIniciados = resolver;
    });
    let liberarSmtp!: () => void;
    antesDeAceptar = new Promise<void>((resolver) => {
      liberarSmtp = resolver;
    });
    anunciarDatos = datosIniciados;

    const peticion = request(app)
      .post('/api/v1/app/cuentas/registro')
      .send(cuerpoRegistro('smtp.lento@ejemplo.cl'));
    const respuestaPendiente = peticion.then((respuesta) => respuesta);
    await inicioDatos;
    const noRespondio = Symbol('el registro siguió esperando al SMTP');
    const respuestaTemprana = await Promise.race([
      respuestaPendiente,
      new Promise<typeof noRespondio>((resolver) => setTimeout(() => resolver(noRespondio), 500)),
    ]);

    liberarSmtp();
    const respuesta = await respuestaPendiente;
    await entorno.esperarSegundoPlano();

    expect(respuestaTemprana).not.toBe(noRespondio);
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toMatchObject({
      tokenAcceso: expect.any(String) as string,
      tokenRenovacion: expect.any(String) as string,
      estudiante: {
        nombre: 'Estudiante SMTP',
        correo: 'smtp.lento@ejemplo.cl',
        correoVerificado: false,
      },
    });
    expect(recibidos).toHaveLength(1);
  });

  it('crea la cuenta con el SMTP caído, no registra datos personales y permite reenviar', async () => {
    const tcp = createServer();
    tcp.listen(0, '127.0.0.1');
    await once(tcp, 'listening');
    const puertoCerrado = (tcp.address() as AddressInfo).port;
    await new Promise<void>((resolver) => tcp.close(() => resolver()));
    const appConSmtpCaido = entorno.crearAppConCorreo(
      new ProveedorCorreoSmtp({
        host: '127.0.0.1',
        puerto: puertoCerrado,
        tls: 'none',
        usuario: undefined,
        clave: undefined,
        remitente: 'no-responder@ejemplo.cl',
        timeoutMs: 150,
      }),
    );
    const errorRegistrado = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const correo = 'smtp.caido@ejemplo.cl';

    const respuesta = await request(appConSmtpCaido)
      .post('/api/v1/app/cuentas/registro')
      .send(cuerpoRegistro(correo));
    await entorno.esperarSegundoPlano();

    expect(respuesta.status).toBe(201);
    const datos = respuesta.body.data as {
      tokenAcceso: string;
      estudiante: { id: string; nombre: string; correo: string; correoVerificado: boolean };
    };
    expect(datos.estudiante).toMatchObject({ correo, correoVerificado: false });
    const cuenta = await entorno.bd.query<{ cantidad: number }>(
      'SELECT count(*)::int AS cantidad FROM app.estudiante WHERE correo = $1',
      [correo],
    );
    expect(cuenta.rows[0]?.cantidad).toBe(1);
    const salida = errorRegistrado.mock.calls.flat().join('\n');
    expect(salida).toContain('No se pudo enviar el correo de verificación');
    for (const dato of [
      correo,
      datos.estudiante.nombre,
      datos.estudiante.id,
      'tranquilo-del-sur',
    ]) {
      expect(salida).not.toContain(dato);
    }

    const reenvio = await request(entorno.app)
      .post('/api/v1/app/cuentas/verificacion/reenviar')
      .set('Authorization', `Bearer ${datos.tokenAcceso}`);
    expect(reenvio.status).toBe(200);
    expect(reenvio.body.data).toEqual({ enviado: true, yaVerificado: false });
  });

  it('el registro y la recuperación envían sus correos en segundo plano', async () => {
    const correo = 'estudiante.smtp@ejemplo.cl';
    const registro = await request(app)
      .post('/api/v1/app/cuentas/registro')
      .send(cuerpoRegistro(correo));

    expect(registro.status).toBe(201);
    await entorno.esperarSegundoPlano();
    expect(recibidos).toHaveLength(1);
    expect(recibidos[0]?.to).toMatchObject({ value: [{ address: correo }] });
    expect(recibidos[0]?.subject).toBe('Verifica tu correo en Supera PAES');
    expect(recibidos[0]?.text).toContain('/verificar-correo?token=');

    const recuperacion = await request(app)
      .post('/api/v1/app/cuentas/recuperacion/solicitar')
      .set('X-Forwarded-For', '203.0.113.20')
      .send({ correo });
    expect(recuperacion.status).toBe(202);
    await entorno.esperarSegundoPlano();

    expect(recibidos).toHaveLength(2);
    expect(recibidos[1]?.to).toMatchObject({ value: [{ address: correo }] });
    expect(recibidos[1]?.subject).toBe('Crea una contraseña nueva en Supera PAES');
    expect(recibidos[1]?.text).toContain('/restablecer-contrasena?token=');
  });
});
