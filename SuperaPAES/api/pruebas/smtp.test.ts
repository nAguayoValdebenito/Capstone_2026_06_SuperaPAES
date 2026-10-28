import { once } from 'node:events';
import net, { type AddressInfo, type Socket } from 'node:net';
import { simpleParser, type ParsedMail } from 'mailparser';
import { SMTPServer } from 'smtp-server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProveedorCorreoSmtp, type OpcionesSmtp } from '../adaptadores/correo/smtp.js';

const servidores: Array<SMTPServer | net.Server> = [];
const sockets = new Set<Socket>();

afterEach(async () => {
  for (const socket of sockets) socket.destroy();
  sockets.clear();
  await Promise.all(
    servidores.splice(0).map(
      (servidor) =>
        new Promise<void>((resolver) => {
          servidor.close(() => resolver());
        }),
    ),
  );
});

async function escuchar(servidor: SMTPServer | net.Server): Promise<number> {
  servidores.push(servidor);
  const tcp = servidor.listen(0, '127.0.0.1');
  await once(tcp, 'listening');
  return (tcp.address() as AddressInfo).port;
}

function opciones(puerto: number, cambios: Partial<OpcionesSmtp> = {}): OpcionesSmtp {
  return {
    host: '127.0.0.1',
    puerto,
    tls: 'none',
    usuario: undefined,
    clave: undefined,
    remitente: 'no-responder@ejemplo.cl',
    timeoutMs: 2_000,
    ...cambios,
  };
}

describe('ProveedorCorreoSmtp', () => {
  it('entrega por SMTP el remitente visible, el destinatario y el contenido UTF-8 completo', async () => {
    let recibido: ParsedMail | undefined;
    const servidor = new SMTPServer({
      authOptional: true,
      disabledCommands: ['STARTTLS'],
      onData(flujo, _sesion, terminar) {
        void simpleParser(flujo).then(
          (correo) => {
            recibido = correo;
            terminar();
          },
          (error: Error) => terminar(error),
        );
      },
    });
    const puerto = await escuchar(servidor);

    await new ProveedorCorreoSmtp(opciones(puerto)).enviar({
      para: 'estudiante@ejemplo.cl',
      asunto: 'Verificación con tildes y ñ',
      texto: 'Tu código de verificación también conserva á, é, í, ó, ú y ñ.',
      html: '<p>Contraseña y año: á, é, í, ó, ú y ñ.</p>',
    });

    expect(recibido?.from?.value).toEqual([
      { address: 'no-responder@ejemplo.cl', name: 'Supera PAES' },
    ]);
    expect(recibido?.to).toMatchObject({
      value: [{ address: 'estudiante@ejemplo.cl', name: '' }],
    });
    expect(recibido?.subject).toBe('Verificación con tildes y ñ');
    expect(recibido?.text).toBe('Tu código de verificación también conserva á, é, í, ó, ú y ñ.');
    expect(recibido?.html).toBe('<p>Contraseña y año: á, é, í, ó, ú y ñ.</p>');
  });

  it('rechaza el envío si STARTTLS es obligatorio y el servidor no lo ofrece', async () => {
    const servidor = new SMTPServer({ authOptional: true, disabledCommands: ['STARTTLS'] });
    const puerto = await escuchar(servidor);

    await expect(
      new ProveedorCorreoSmtp(opciones(puerto, { tls: 'starttls' })).enviar({
        para: 'estudiante@ejemplo.cl',
        asunto: 'Prueba',
        texto: 'Contenido',
      }),
    ).rejects.toMatchObject({ name: 'ErrorEnvioCorreoSmtp' });
  });

  it('agota el timeout sin revelar la clave, el destinatario, el cuerpo, el enlace ni el código', async () => {
    const servidor = net.createServer((socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    const puerto = await escuchar(servidor);
    const clave = ['clave', 'smtp', 'de', 'prueba'].join('-');
    const registrar = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const inicio = Date.now();

    const envio = new ProveedorCorreoSmtp(
      opciones(puerto, {
        usuario: 'usuario-smtp',
        clave,
        timeoutMs: 150,
      }),
    ).enviar({
      para: 'persona.real@ejemplo.cl',
      asunto: 'Código 123456',
      texto: 'Abre https://ejemplo.cl/secreto y usa 123456.',
    });

    await expect(envio).rejects.toEqual(
      expect.objectContaining({
        name: 'ErrorEnvioCorreoSmtp',
        message: 'No se pudo enviar el correo por SMTP.',
      }),
    );
    expect(Date.now() - inicio).toBeLessThan(2_000);
    const salida = registrar.mock.calls.flat().join('\n');
    expect(salida).toContain('No se pudo enviar el correo por SMTP');
    for (const dato of [clave, 'persona.real@ejemplo.cl', '123456', 'https://ejemplo.cl/secreto']) {
      expect(salida).not.toContain(dato);
    }
  });
});
