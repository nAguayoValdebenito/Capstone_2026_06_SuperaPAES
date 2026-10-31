// Inventario de las rutas de /api/v1/app/cuentas (DAS 4.3.3): solo son públicas las de ingreso, registro,
// renovación y cierre de sesión, la verificación con el enlace, la recuperación de la contraseña y los
// documentos legales vigentes. Cualquier otra ruta de cuentas (por ejemplo GET /cuentas/yo) debe responder
// 401 sin sesión. Si se agrega una ruta, esta tabla se actualiza a propósito: así no queda abierta por olvido.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearEscenarioSesiones } from './escenario-sesiones.js';

const APP_API = '/api/v1/app';

interface CapaExpress {
  handle: unknown;
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] };
  match(ruta: string): boolean;
}

const pilaDe = (manejador: unknown): CapaExpress[] | null => {
  const pila = (manejador as { stack?: unknown } | null)?.stack;
  return typeof manejador === 'function' && Array.isArray(pila) ? (pila as CapaExpress[]) : null;
};

/** Rutas del router de cuentas montado en la app (con autenticación real, no la de aceptarCualquierSesion). */
function rutasDeCuentas(app: unknown): { metodo: string; ruta: string; manejadores: unknown[] }[] {
  const { router } = app as { router: { stack: CapaExpress[] } };
  const rutaApp = router.stack.find(
    (capa) => pilaDe(capa.handle) && capa.match(`${APP_API}/cuentas`),
  );
  const cuentas = pilaDe(rutaApp?.handle)?.find(
    (capa) => pilaDe(capa.handle) && capa.match('/cuentas'),
  );
  return (pilaDe(cuentas?.handle) ?? [])
    .filter((capa) => capa.route)
    .flatMap((capa) =>
      Object.keys(capa.route?.methods ?? {}).map((metodo) => ({
        metodo: metodo.toUpperCase(),
        ruta: capa.route?.path ?? '',
        manejadores: capa.route?.stack.map((c) => c.handle) ?? [],
      })),
    );
}

/** Rutas sin sesión, por decisión del DAS 4.3.3. */
const PUBLICAS = new Set([
  'POST /registro',
  'POST /ingreso',
  'GET /documentos-legales/vigentes',
  'POST /renovar',
  'POST /cerrar',
  'POST /verificacion/enlace',
  'POST /recuperacion/solicitar',
  'POST /recuperacion/restablecer',
]);

describe('inventario de rutas de /api/v1/app/cuentas', () => {
  const { app } = crearEscenarioSesiones();
  const detalle = rutasDeCuentas(app);
  const rutas = detalle.map(({ metodo, ruta }) => `${metodo} ${ruta}`);

  it('las rutas públicas son las del DAS 4.3.3 y GET /yo (el estado de la cuenta) exige sesión', () => {
    expect(rutas.length).toBeGreaterThan(PUBLICAS.size);
    expect(rutas).toContain('GET /yo');
    expect(rutas.filter((r) => PUBLICAS.has(r)).sort()).toEqual([...PUBLICAS].sort());
  });

  it('toda ruta que no es pública responde 401 sin sesión', async () => {
    const protegidas = rutas.filter((r) => !PUBLICAS.has(r));
    expect(protegidas).toContain('GET /yo');

    for (const entrada of protegidas) {
      const [metodo = 'GET', ruta = ''] = entrada.split(' ');
      const url = `${APP_API}/cuentas${ruta.replaceAll(/:\w+/g, '1')}`;
      const verbo = metodo.toLowerCase() as 'get' | 'post' | 'put' | 'delete';
      const respuesta = await request(app)[verbo](url).send({});
      expect(respuesta.status, entrada).toBe(401);
      expect(respuesta.body.error.codigo, entrada).toBe('NO_AUTENTICADO');
    }
  });

  it('toda ruta que no es pública empieza con el mismo middleware, que rechaza una petición sin sesión', async () => {
    // El controlador de GET /yo también rechaza sin sesión (estudianteDe), así que el 401 de arriba no basta
    // para saber que la ruta lleva autenticarApp en su cadena: se compara el primer manejador de cada ruta.
    const protegidas = detalle.filter(({ metodo, ruta }) => !PUBLICAS.has(`${metodo} ${ruta}`));
    const primeros = new Set(protegidas.map(({ manejadores }) => manejadores[0]));
    expect(primeros.size).toBe(1);

    const autenticar = [...primeros][0] as (...args: unknown[]) => unknown;
    let error: unknown;
    const siguiente = (e?: unknown) => {
      error = e;
    };
    try {
      await autenticar({ headers: {}, get: () => undefined }, {}, siguiente);
    } catch (e) {
      error = e;
    }
    expect((error as { codigo?: string } | undefined)?.codigo).toBe('NO_AUTENTICADO');
  });
});
