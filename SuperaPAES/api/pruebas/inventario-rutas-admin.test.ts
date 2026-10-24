// Inventario de rutas de /api/v1/admin (HU-03.1, DAS 4.3.3): recorre los routers de Express montados
// en la consola y falla si una ruta no declara su permiso (exigirRol o rutaPublica), si un módulo
// aplica un rol a todo su router o si la tabla de cada ruta con su rol cambia sin actualizarla aquí
// y en docs/arquitectura.md. Así una ruta nueva no queda abierta por olvido.
import type { RequestHandler } from 'express';
import { describe, expect, it } from 'vitest';
import { permisoDeclarado } from '../comun/middleware/autorizacion.js';
import { crearAppDePrueba } from './ayudantes.js';

const ADMIN_API = '/api/v1/admin';

interface CapaExpress {
  handle: unknown;
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] };
  match(ruta: string): boolean;
}

interface RutaInventario {
  ruta: string;
  manejadores: unknown[];
}

const MODULOS_ADMIN = [
  'cuentas',
  'temario',
  'preguntas',
  'generador',
  'revision',
  'suscripciones',
  'privacidad',
  'administracion',
];

function pilaDe(manejador: unknown): CapaExpress[] | null {
  const pila = (manejador as { stack?: unknown } | null)?.stack;
  return typeof manejador === 'function' && Array.isArray(pila) ? (pila as CapaExpress[]) : null;
}

/** Routers anidados (con el nombre del módulo en que se montan) y rutas con su cadena. */
function recorrer(
  capas: CapaExpress[],
  prefijo: string,
  rutas: RutaInventario[],
  sueltas: unknown[],
) {
  for (const capa of capas) {
    const hijas = pilaDe(capa.handle);
    if (capa.route) {
      for (const metodo of Object.keys(capa.route.methods)) {
        rutas.push({
          ruta: `${metodo.toUpperCase()} ${prefijo}${capa.route.path}`,
          manejadores: capa.route.stack.map((c) => c.handle),
        });
      }
    } else if (hijas) {
      const modulo = MODULOS_ADMIN.find((m) => capa.match(`/${m}`)) ?? '(sin nombre)';
      recorrer(hijas, `${prefijo}/${modulo}`, rutas, sueltas);
    } else {
      sueltas.push(capa.handle);
    }
  }
}

function inventarioAdmin() {
  const app = crearAppDePrueba() as unknown as { router: { stack: CapaExpress[] } };
  const admin = app.router.stack.find(
    (capa) => pilaDe(capa.handle) && capa.match(ADMIN_API) && !capa.match('/api/v1/app'),
  );
  const rutas: RutaInventario[] = [];
  const middlewareDeModulo: unknown[] = [];
  recorrer(pilaDe(admin?.handle) ?? [], '', rutas, middlewareDeModulo);
  return { rutas, middlewareDeModulo };
}

const permisoDe = ({ manejadores }: RutaInventario) => {
  const declarados = manejadores.map(permisoDeclarado).filter((p) => p !== undefined);
  return declarados.length === 1 ? declarados[0] : declarados;
};

describe('inventario de rutas de /api/v1/admin (HU-03.1)', () => {
  it('toda ruta declara su permiso en su propia cadena: exigirRol(...) o rutaPublica', () => {
    const { rutas } = inventarioAdmin();

    const sinPermiso = rutas
      .filter(({ manejadores }) => !manejadores.some((m) => permisoDeclarado(m) !== undefined))
      .map(({ ruta }) => ruta);

    expect(rutas.length).toBeGreaterThan(10);
    expect(sinPermiso).toEqual([]);
  });

  it('los routers de los módulos no aplican roles a todo el módulo (solo autenticación)', () => {
    const { middlewareDeModulo } = inventarioAdmin();

    const conRol = middlewareDeModulo.filter((m) => permisoDeclarado(m as RequestHandler));

    expect(conRol).toEqual([]);
  });

  it('cada ruta exige el rol que la usa (DAS 4.3.3; esta tabla está en docs/arquitectura.md)', () => {
    const tabla = Object.fromEntries(inventarioAdmin().rutas.map((r) => [r.ruta, permisoDe(r)]));

    expect(tabla).toEqual({
      'POST /cuentas/ingreso': 'publica',
      'POST /cuentas/renovar': 'publica',
      'POST /cuentas/cerrar': 'publica',
      'GET /cuentas/yo': ['admin', 'docente'],
      'GET /temario/areas': ['admin'],
      'GET /revision/mis-revisiones': ['docente'],
      'GET /revision/desempates': ['docente'],
      'GET /revision/seguimiento': ['admin'],
      'GET /administracion/usuarios-internos': ['admin'],
      'POST /administracion/usuarios-internos': ['admin'],
      'PATCH /administracion/usuarios-internos/:id': ['admin'],
      'POST /administracion/usuarios-internos/:id/activar': ['admin'],
      'POST /administracion/usuarios-internos/:id/desactivar': ['admin'],
    });
  });
});
