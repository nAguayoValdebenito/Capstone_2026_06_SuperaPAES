// Recuperación de la contraseña: concurrencia contra PostgreSQL real (HU-06.1). Crear la contraseña con
// un enlace mientras otra petición pide uno nuevo no debe bloquearse (deadlock): las dos transacciones
// toman la cuenta y después el enlace, siempre en el mismo orden. Hallazgo de la revisión de código.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usarBaseDeSesiones } from './base-sesiones.js';
import { exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';
import { CLAVE_NUEVA, crearAyudantesDeRecuperacion, EVA } from './recuperacion-de-prueba.js';

const RONDAS = 12;

describe('recuperación de la contraseña, concurrencia, sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('recuperación de la contraseña, concurrencia, con PostgreSQL', () => {
  const entorno = usarBaseDeSesiones('recuperacion_concurrencia');
  let app: ReturnType<typeof entorno.crearAppConLimite>;
  const { solicitar, restablecer, pedirEnlace } = crearAyudantesDeRecuperacion(entorno, () => app);
  const nuevaApp = () => entorno.crearAppConLimite({ ventanaMs: 60_000, maximo: 1000 });

  beforeEach(() => {
    app = nuevaApp();
  });

  it(
    `crear la contraseña y pedir otro enlace a la vez, ${String(RONDAS)} veces: sin errores ni bloqueos`,
    async () => {
      await crearEstudianteDePrueba(entorno.bd, EVA);
      const registrados = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      for (let ronda = 0; ronda < RONDAS; ronda++) {
        // Una app nueva por ronda: los límites de la recuperación (3 por hora por correo) empiezan en cero.
        app = nuevaApp();
        const { token } = await pedirEnlace(EVA.correo, '203.0.113.1');

        const [cambio, otra] = await Promise.all([
          restablecer(token, `${CLAVE_NUEVA}-${String(ronda)}`),
          solicitar(EVA.correo, '203.0.113.2'),
        ]);
        await entorno.esperarSegundoPlano();

        // Gana el cambio (200) o gana el enlace nuevo, que anuló al anterior (409); nunca un error.
        expect([200, 409]).toContain(cambio.status);
        expect(otra.status).toBe(202);
      }

      const errores = registrados.mock.calls.map((llamada) => llamada.join(' ')).join('\n');
      expect(errores).not.toMatch(/deadlock|40P01|ERROR_INTERNO|No se pudo emitir/);
      // Cada ronda cifra una contraseña (bcrypt, costo 12): con las demás pruebas en paralelo pasa de 5 s.
    },
    MINUTO,
  );

  it('dos solicitudes simultáneas de la misma cuenta dejan un solo enlace vigente y envían los dos correos', async () => {
    const id = await crearEstudianteDePrueba(entorno.bd, EVA);

    await Promise.all([solicitar(EVA.correo, '203.0.113.1'), solicitar(EVA.correo, '203.0.113.2')]);
    await entorno.esperarSegundoPlano();

    const { rows } = await entorno.bd.query<{ vigentes: number; total: number }>(
      `SELECT count(*) FILTER (WHERE usado_en IS NULL AND anulado_en IS NULL)::int AS vigentes,
              count(*)::int AS total
         FROM app.token_correo t JOIN contenido.tipo_token_correo tt ON tt.id = t.tipo_token_correo_id
        WHERE t.estudiante_id = $1 AND tt.codigo = 'recuperacion'`,
      [id],
    );
    expect(rows[0]).toEqual({ vigentes: 1, total: 2 });
    expect(entorno.correos).toHaveLength(2);
  });
});
