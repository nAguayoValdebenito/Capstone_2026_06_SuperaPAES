// Recuperación de la contraseña: límites de intentos, CORS y registros (HU-06.1, RNF-02, CU-04) contra
// PostgreSQL real. Los casos de CP-06 están en recuperacion-bd.test.ts.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { URL_CONSOLA_DE_PRUEBA } from './ayudantes.js';
import { usarBaseDeSesiones } from './base-sesiones.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';
import {
  CLAVE_NUEVA,
  CLAVE_VIEJA,
  crearAyudantesDeRecuperacion,
  EVA,
  RESTABLECER,
  SOLICITAR,
} from './recuperacion-de-prueba.js';

describe('recuperación de la contraseña, límites y registros, sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)(
  'recuperación de la contraseña, límites y registros, con PostgreSQL',
  () => {
    const entorno = usarBaseDeSesiones('recuperacion_limites');
    let app: ReturnType<typeof entorno.crearAppConLimite>;
    const { solicitar, restablecer, pedirEnlace } = crearAyudantesDeRecuperacion(
      entorno,
      () => app,
    );

    beforeEach(() => {
      app = entorno.crearAppConLimite({ ventanaMs: 60_000, maximo: 1000 });
    });

    describe('límites de intentos y CORS (RNF-02)', () => {
      it('pedir la recuperación tiene un límite de 3 por hora por correo, con distintas IP', async () => {
        await crearEstudianteDePrueba(entorno.bd, EVA);

        const estados = [];
        for (let i = 0; i < 4; i++)
          estados.push((await solicitar(EVA.correo, `203.0.113.${String(i + 1)}`)).status);
        await entorno.esperarSegundoPlano();

        expect(estados).toEqual([202, 202, 202, 429]);
        expect(entorno.correos).toHaveLength(3);
      });

      it('el límite por correo también cuenta los correos que no existen (no sirve para adivinarlos)', async () => {
        const estados = [];
        for (let i = 0; i < 4; i++) {
          estados.push((await solicitar('nadie@ejemplo.cl', `203.0.113.${String(i + 1)}`)).status);
        }

        expect(estados).toEqual([202, 202, 202, 429]);
      });

      it('pedir la recuperación tiene un límite de 5 por hora por IP, con distintos correos', async () => {
        const estados = [];
        for (let i = 0; i < 6; i++)
          estados.push((await solicitar(`persona${String(i)}@ejemplo.cl`)).status);

        expect(estados).toEqual([202, 202, 202, 202, 202, 429]);
      });

      it('crear la contraseña cuenta solo los intentos fallidos por IP (10 en 15 minutos)', async () => {
        // El límite general de la API es de 10 por IP: esta prueba usa una app con ese valor.
        app = entorno.crearAppConLimite({ ventanaMs: 15 * 60_000, maximo: 10 });
        await crearEstudianteDePrueba(entorno.bd, EVA);
        const { token } = await pedirEnlace();

        const fallidos = [];
        for (let i = 0; i < 11; i++)
          fallidos.push((await restablecer(`inventado-${String(i)}`)).status);
        const conElBueno = await restablecer(token);

        expect(fallidos.slice(0, 10).every((estado) => estado === 409)).toBe(true);
        expect(fallidos[10]).toBe(429);
        expect(conElBueno.status).toBe(429);
      });

      it('CORS permite a la consola llamar a las dos rutas desde el navegador', async () => {
        const preflight = (ruta: string, origen: string) =>
          request(app)
            .options(ruta)
            .set('Origin', origen)
            .set('Access-Control-Request-Method', 'POST');

        for (const ruta of [SOLICITAR, RESTABLECER]) {
          const consola = await preflight(ruta, URL_CONSOLA_DE_PRUEBA);
          const otro = await preflight(ruta, 'https://otro-sitio.ejemplo');

          expect(consola.headers['access-control-allow-origin']).toBe(URL_CONSOLA_DE_PRUEBA);
          expect(otro.headers['access-control-allow-origin']).toBeUndefined();
        }
      });
    });

    it('ningún registro del servidor contiene el enlace ni la contraseña, y las respuestas no incluyen hashes', async () => {
      const id = await crearEstudianteDePrueba(entorno.bd, EVA);
      const info = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      entorno.fallarCorreo(true);
      const fallido = await solicitar(EVA.correo, '203.0.113.9');
      await entorno.esperarSegundoPlano();
      entorno.fallarCorreo(false);
      const { token } = await pedirEnlace(EVA.correo, '203.0.113.8');
      const respuestas = [
        fallido,
        await restablecer('inventado', CLAVE_NUEVA),
        await restablecer(token, 'corta12'),
        await restablecer(token, CLAVE_NUEVA),
        await restablecer(token, CLAVE_NUEVA),
      ];

      const registros = [...info.mock.calls, ...error.mock.calls]
        .map((l) => l.join(' '))
        .join('\n');
      for (const secreto of [token, CLAVE_NUEVA, 'corta12', CLAVE_VIEJA, 'inventado']) {
        expect(registros).not.toContain(secreto);
      }
      const hashes = (
        await entorno.bd.query<{ h: string }>(
          `SELECT hash_contrasena AS h FROM app.estudiante WHERE id = $1
         UNION ALL SELECT hash_token FROM app.token_correo WHERE estudiante_id = $1`,
          [id],
        )
      ).rows.map((fila) => fila.h);
      for (const cuerpo of respuestas.map((r) => JSON.stringify(r.body))) {
        expect(cuerpo).not.toMatch(/hash|\$2[aby]\$/i);
        expect(cuerpo).not.toContain(CLAVE_NUEVA);
        for (const h of hashes) expect(cuerpo).not.toContain(h);
      }
    });
  },
);
