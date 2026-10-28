// Integración de los dos flujos de correo con el adaptador SMTP real y un servidor local falso.
import { once } from 'node:events';
import { readdir } from 'node:fs/promises';
import { type AddressInfo } from 'node:net';
import path from 'node:path';
import type { Express } from 'express';
import { simpleParser, type ParsedMail } from 'mailparser';
import request from 'supertest';
import { SMTPServer } from 'smtp-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
  const smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ['STARTTLS'],
    onData(flujo, _sesion, terminar) {
      void simpleParser(flujo).then(
        (correo) => {
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

  it('el registro espera su correo y la recuperación envía el segundo en segundo plano', async () => {
    const correo = 'estudiante.smtp@ejemplo.cl';
    const registro = await request(app).post('/api/v1/app/cuentas/registro').send({
      nombre: 'Estudiante SMTP',
      correo,
      contrasena: 'tranquilo-del-sur',
      declaraTenerCatorceAnios: true,
      documentosAceptados: documentosVigentes,
    });

    expect(registro.status).toBe(201);
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
