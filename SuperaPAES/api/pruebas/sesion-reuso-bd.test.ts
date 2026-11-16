// Detección del reuso del token de renovación contra PostgreSQL real (RNF-01, migración 011): familia y
// reemplazada_por en app.token_sesion, revocación de la familia confirmada aunque la respuesta sea 401
// (se lee desde otra conexión) y sin tocar otros ingresos. Un token cerrado por el usuario o vencido sin
// rotar no cierra nada más. La misma regla sin base está en sesion-reuso-token.test.ts.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { DURACION_TOKEN_RENOVACION_SEGUNDOS } from '../modulos/cuentas/cuentas.servicio.js';
import { usarBaseDeSesiones } from './base-sesiones.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import {
  RUTA_CERRAR_APP,
  RUTA_INGRESO,
  RUTA_INGRESO_APP,
  RUTA_RENOVAR,
  RUTA_RENOVAR_APP,
  sha256,
} from './escenario-sesiones.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';

const EVA = { correo: 'eva@ejemplo.cl', contrasena: 'clave-de-eva-1' };

interface FilaFamilia {
  id: string;
  hash_token: string;
  familia: string;
  reemplazada_por: string | null;
  abierta: boolean;
}

type Tokens = { tokenAcceso: string; tokenRenovacion: string };

describe('reuso del token de renovación sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('reuso del token de renovación con PostgreSQL', () => {
  const entorno = usarBaseDeSesiones('reuso');

  /** Sesiones de la cuenta: de la consola (usuario interno) o de la app (estudiante). */
  const filas = async (columna: 'estudiante_id' | 'usuario_interno_id', cuentaId: string) =>
    (
      await entorno.bd.query<FilaFamilia>(
        `SELECT id::text AS id, hash_token, familia::text AS familia,
                reemplazada_por::text AS reemplazada_por, revocado_en IS NULL AS abierta
           FROM app.token_sesion
          WHERE COALESCE(usuario_interno_id, estudiante_id) = $1
            AND (usuario_interno_id IS NOT NULL) = $2
          ORDER BY id`,
        [cuentaId, columna === 'usuario_interno_id'],
      )
    ).rows;
  const deToken = (lista: FilaFamilia[], token: string) =>
    lista.find((f) => f.hash_token === sha256(token));
  const ingresarApp = async () =>
    (await request(entorno.app).post(RUTA_INGRESO_APP).send(EVA)).body.data as Tokens;
  const renovarApp = (tokenRenovacion: string) =>
    request(entorno.app).post(RUTA_RENOVAR_APP).send({ tokenRenovacion });

  it('las filas sin familia explícita reciben cada una la suya y quedan sin reemplazo', async () => {
    const id = await crearEstudianteDePrueba(entorno.bd, EVA);
    await entorno.bd.query(
      `INSERT INTO app.token_sesion (estudiante_id, hash_token, expira_en)
       VALUES ($1, 'a', now() + interval '1 day'), ($1, 'b', now() + interval '1 day')`,
      [id],
    );

    const [a, b] = await filas('estudiante_id', id);

    expect(a?.familia).toMatch(/^[0-9a-f-]{36}$/);
    expect(a?.familia).not.toBe(b?.familia);
    expect([a?.reemplazada_por, b?.reemplazada_por]).toEqual([null, null]);
  });

  it('la renovación hereda la familia y marca la consumida con la sesión que la reemplazó', async () => {
    const id = await crearEstudianteDePrueba(entorno.bd, EVA);
    const telefono = await ingresarApp();
    const tablet = await ingresarApp();

    const renovada = (await renovarApp(telefono.tokenRenovacion)).body.data as Tokens;

    const lista = await filas('estudiante_id', id);
    const consumida = deToken(lista, telefono.tokenRenovacion);
    const nueva = deToken(lista, renovada.tokenRenovacion);
    expect(nueva?.familia).toBe(consumida?.familia);
    expect(consumida?.reemplazada_por).toBe(nueva?.id);
    expect(deToken(lista, tablet.tokenRenovacion)?.familia).not.toBe(consumida?.familia);
  });

  it('app: un token rotado cierra su familia (confirmado pese al 401) y no toca otro dispositivo', async () => {
    const id = await crearEstudianteDePrueba(entorno.bd, EVA);
    const telefono = await ingresarApp();
    const tablet = await ingresarApp();
    const renovada = (await renovarApp(telefono.tokenRenovacion)).body.data as Tokens;

    const reuso = await renovarApp(telefono.tokenRenovacion);

    const lista = await filas('estudiante_id', id);
    expect(reuso.status).toBe(401);
    expect(deToken(lista, renovada.tokenRenovacion)?.abierta).toBe(false);
    expect(deToken(lista, renovada.tokenRenovacion)?.reemplazada_por).toBeNull();
    expect(deToken(lista, tablet.tokenRenovacion)?.abierta).toBe(true);
    expect((await renovarApp(tablet.tokenRenovacion)).status).toBe(200);
  });

  it('app: reintentar con el token de una sesión cerrada por el usuario no cierra otras', async () => {
    const id = await crearEstudianteDePrueba(entorno.bd, EVA);
    const telefono = await ingresarApp();
    const tablet = await ingresarApp();
    await request(entorno.app)
      .post(RUTA_CERRAR_APP)
      .send({ tokenRenovacion: telefono.tokenRenovacion });

    const reintento = await renovarApp(telefono.tokenRenovacion);

    const lista = await filas('estudiante_id', id);
    expect(reintento.status).toBe(401);
    expect(deToken(lista, telefono.tokenRenovacion)?.reemplazada_por).toBeNull();
    expect(deToken(lista, tablet.tokenRenovacion)?.abierta).toBe(true);
  });

  it('app: un token vencido sin rotar no dispara la revocación', async () => {
    const id = await crearEstudianteDePrueba(entorno.bd, EVA);
    const vieja = await ingresarApp();
    entorno.avanzarSegundos(DURACION_TOKEN_RENOVACION_SEGUNDOS.app + 1);
    const nueva = await ingresarApp();

    const vencida = await renovarApp(vieja.tokenRenovacion);

    const lista = await filas('estudiante_id', id);
    expect(vencida.status).toBe(401);
    expect(deToken(lista, nueva.tokenRenovacion)?.abierta).toBe(true);
  });

  it('consola: un token rotado cierra la sesión vigente de ese navegador y no la de otro', async () => {
    const admin = await entorno.crearAdmin();
    const ingresar = async () =>
      (await request(entorno.app).post(RUTA_INGRESO).send(admin)).body.data as Tokens & {
        usuario: { id: number };
      };
    const navegador = await ingresar();
    const otroNavegador = await ingresar();
    const renovar = (tokenRenovacion: string) =>
      request(entorno.app).post(RUTA_RENOVAR).send({ tokenRenovacion });
    const renovada = (await renovar(navegador.tokenRenovacion)).body.data as Tokens;

    const reuso = await renovar(navegador.tokenRenovacion);

    const lista = await filas('usuario_interno_id', String(navegador.usuario.id));
    expect(reuso.status).toBe(401);
    expect(deToken(lista, renovada.tokenRenovacion)?.abierta).toBe(false);
    expect(deToken(lista, otroNavegador.tokenRenovacion)?.abierta).toBe(true);
    expect((await renovar(otroNavegador.tokenRenovacion)).status).toBe(200);
  });
});
