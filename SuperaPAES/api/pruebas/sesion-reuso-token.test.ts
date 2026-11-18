// Detección del reuso del token de renovación (RNF-01), sin base real: renovar con un token ya rotado
// cierra las sesiones abiertas de su familia (el mismo ingreso) y no toca las de otro dispositivo; un
// token cerrado por el usuario, vencido o inventado no cierra nada más. Vale para la app y la consola.
// Lo mismo contra PostgreSQL, incluida la confirmación de la revocación antes del 401, está en
// sesion-reuso-bd.test.ts.
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { registro } from '../comun/registro.js';
import { DURACION_TOKEN_RENOVACION_SEGUNDOS } from '../modulos/cuentas/cuentas.servicio.js';
import { errorConFormato } from './ayudantes.js';
import {
  ADMIN,
  conCuentas,
  conToken,
  crearEscenarioSesiones,
  RUTA_APP_PROTEGIDA,
  RUTA_CERRAR,
  RUTA_CERRAR_APP,
  RUTA_RENOVAR,
  RUTA_RENOVAR_APP,
  RUTA_YO,
  sesionDe,
} from './escenario-sesiones.js';

type Tokens = { tokenAcceso: string; tokenRenovacion: string };
type Escenario = ReturnType<typeof crearEscenarioSesiones>;

const EVA = { correo: 'eva@ejemplo.cl', contrasena: 'clave-de-eva-1' };
const EVENTO = 'reuso_token_renovacion';

/** Llamadas a registro.info con el evento del reuso. */
const eventosDeReuso = (info: { mock: { calls: unknown[][] } }) =>
  info.mock.calls.filter(
    ([, campos]) => (campos as { evento?: string } | undefined)?.evento === EVENTO,
  );

describe('reuso del token de renovación en la app', () => {
  async function conDosDispositivos() {
    const escenario = crearEscenarioSesiones();
    const id = await escenario.crearEstudiante(EVA);
    const telefono = (await escenario.ingresarApp(EVA.correo, EVA.contrasena)).body.data as Tokens;
    const tablet = (await escenario.ingresarApp(EVA.correo, EVA.contrasena)).body.data as Tokens;
    return { escenario, id, telefono, tablet };
  }
  const renovar = (escenario: Escenario, tokenRenovacion: string) =>
    request(escenario.app).post(RUTA_RENOVAR_APP).send({ tokenRenovacion });
  const usarAcceso = (escenario: Escenario, tokenAcceso: string) =>
    request(escenario.app).get(RUTA_APP_PROTEGIDA).set(conToken(tokenAcceso));

  it('cada ingreso abre su familia y la renovación la hereda, marcando la sesión reemplazada', async () => {
    const { escenario, telefono } = await conDosDispositivos();

    await renovar(escenario, telefono.tokenRenovacion);

    const [primera, otroIngreso, renovada] = [...escenario.sesiones.values()];
    expect(otroIngreso?.familia).not.toBe(primera?.familia);
    expect(renovada?.familia).toBe(primera?.familia);
    expect(primera?.reemplazadaPor).toBe(renovada?.id);
    expect(otroIngreso?.reemplazadaPor).toBeNull();
  });

  it('un token ya rotado responde 401, cierra la sesión vigente de su familia y no toca la otra', async () => {
    const { escenario, id, telefono, tablet } = await conDosDispositivos();
    const info = vi.spyOn(registro, 'info');
    const renovada = (await renovar(escenario, telefono.tokenRenovacion)).body.data as Tokens;

    const reuso = await renovar(escenario, telefono.tokenRenovacion);

    expect(reuso.status).toBe(401);
    expect(reuso.body).toEqual(errorConFormato('NO_AUTENTICADO'));
    expect((await usarAcceso(escenario, renovada.tokenAcceso)).status).toBe(401);
    expect((await renovar(escenario, renovada.tokenRenovacion)).status).toBe(401);
    expect((await usarAcceso(escenario, tablet.tokenAcceso)).status).toBe(404);
    expect((await renovar(escenario, tablet.tokenRenovacion)).status).toBe(200);
    expect(eventosDeReuso(info)).toEqual([
      [expect.any(String), { evento: EVENTO, tipo: 'app', cuentaId: id }],
    ]);
    const registrado = JSON.stringify(info.mock.calls);
    for (const token of [telefono, renovada].flatMap((t) => Object.values(t))) {
      expect(registrado).not.toContain(token);
    }
  });

  it('el reuso de un token antiguo de la cadena también cierra la sesión vigente', async () => {
    const { escenario, telefono } = await conDosDispositivos();
    const segunda = (await renovar(escenario, telefono.tokenRenovacion)).body.data as Tokens;
    const tercera = (await renovar(escenario, segunda.tokenRenovacion)).body.data as Tokens;

    expect((await renovar(escenario, telefono.tokenRenovacion)).status).toBe(401);

    expect((await renovar(escenario, tercera.tokenRenovacion)).status).toBe(401);
  });

  it('reintentar con el token de una sesión cerrada por el usuario no cierra otras sesiones', async () => {
    const { escenario, telefono, tablet } = await conDosDispositivos();
    const info = vi.spyOn(registro, 'info');
    const renovada = (await renovar(escenario, telefono.tokenRenovacion)).body.data as Tokens;
    await request(escenario.app)
      .post(RUTA_CERRAR_APP)
      .send({ tokenRenovacion: renovada.tokenRenovacion });

    const reintento = await renovar(escenario, renovada.tokenRenovacion);

    expect(reintento.status).toBe(401);
    expect((await usarAcceso(escenario, tablet.tokenAcceso)).status).toBe(404);
    expect(eventosDeReuso(info)).toHaveLength(0);
  });

  it('un token vencido sin rotar no dispara la revocación', async () => {
    const escenario = crearEscenarioSesiones();
    await escenario.crearEstudiante(EVA);
    const vieja = (await escenario.ingresarApp(EVA.correo, EVA.contrasena)).body.data as Tokens;
    escenario.avanzarSegundos(DURACION_TOKEN_RENOVACION_SEGUNDOS.app + 1);
    const nueva = (await escenario.ingresarApp(EVA.correo, EVA.contrasena)).body.data as Tokens;
    const info = vi.spyOn(registro, 'info');

    const vencida = await renovar(escenario, vieja.tokenRenovacion);

    expect(vencida.status).toBe(401);
    expect((await usarAcceso(escenario, nueva.tokenAcceso)).status).toBe(404);
    expect(eventosDeReuso(info)).toHaveLength(0);
  });

  it('un token desconocido no cierra nada ni registra el evento', async () => {
    const { escenario, telefono } = await conDosDispositivos();
    const info = vi.spyOn(registro, 'info');

    expect((await renovar(escenario, 'token-que-no-existe')).status).toBe(401);

    expect((await usarAcceso(escenario, telefono.tokenAcceso)).status).toBe(404);
    expect(eventosDeReuso(info)).toHaveLength(0);
  });

  it('un token rotado de la app no sirve para detectar reuso en la consola', async () => {
    const { escenario, telefono } = await conDosDispositivos();
    const renovada = (await renovar(escenario, telefono.tokenRenovacion)).body.data as Tokens;

    const enLaConsola = await request(escenario.app)
      .post(RUTA_RENOVAR)
      .send({ tokenRenovacion: telefono.tokenRenovacion });

    expect(enLaConsola.status).toBe(401);
    expect((await usarAcceso(escenario, renovada.tokenAcceso)).status).toBe(404);
  });
});

describe('reuso del token de renovación en la consola', () => {
  const renovar = (escenario: Escenario, tokenRenovacion: string) =>
    request(escenario.app).post(RUTA_RENOVAR).send({ tokenRenovacion });
  const yo = (escenario: Escenario, tokenAcceso: string) =>
    request(escenario.app).get(RUTA_YO).set(conToken(tokenAcceso));

  it('un token ya rotado cierra la sesión vigente de ese navegador y no la de otro', async () => {
    const escenario = await conCuentas();
    const navegador = await sesionDe(escenario, ADMIN);
    const otroNavegador = await sesionDe(escenario, ADMIN);
    const info = vi.spyOn(registro, 'info');
    const renovada = (await renovar(escenario, navegador.tokenRenovacion)).body.data as Tokens;

    const reuso = await renovar(escenario, navegador.tokenRenovacion);

    expect(reuso.status).toBe(401);
    expect(reuso.body).toEqual(errorConFormato('NO_AUTENTICADO'));
    expect((await yo(escenario, renovada.tokenAcceso)).status).toBe(401);
    expect((await renovar(escenario, renovada.tokenRenovacion)).status).toBe(401);
    expect((await yo(escenario, otroNavegador.tokenAcceso)).status).toBe(200);
    expect(eventosDeReuso(info)).toEqual([
      [expect.any(String), { evento: EVENTO, tipo: 'admin', cuentaId: escenario.adminId }],
    ]);
  });

  it('reintentar con el token de una sesión cerrada no cierra otras sesiones', async () => {
    const escenario = await conCuentas();
    const navegador = await sesionDe(escenario, ADMIN);
    const otroNavegador = await sesionDe(escenario, ADMIN);
    const info = vi.spyOn(registro, 'info');
    await request(escenario.app)
      .post(RUTA_CERRAR)
      .send({ tokenRenovacion: navegador.tokenRenovacion });

    expect((await renovar(escenario, navegador.tokenRenovacion)).status).toBe(401);

    expect((await yo(escenario, otroNavegador.tokenAcceso)).status).toBe(200);
    expect(eventosDeReuso(info)).toHaveLength(0);
  });

  it('un token vencido sin rotar no dispara la revocación', async () => {
    const escenario = await conCuentas();
    const vieja = await sesionDe(escenario, ADMIN);
    escenario.avanzarSegundos(DURACION_TOKEN_RENOVACION_SEGUNDOS.admin + 1);
    const nueva = await sesionDe(escenario, ADMIN);
    const info = vi.spyOn(registro, 'info');

    expect((await renovar(escenario, vieja.tokenRenovacion)).status).toBe(401);

    expect((await yo(escenario, nueva.tokenAcceso)).status).toBe(200);
    expect(eventosDeReuso(info)).toHaveLength(0);
  });
});
