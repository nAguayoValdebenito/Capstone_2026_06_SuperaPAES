import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cambiarEstadoUsuarioInterno,
  crearUsuarioInterno,
  editarUsuarioInterno,
  listarUsuariosInternos,
} from './administracion';
import { listarAreas } from './temario';

function capturarFetch() {
  const llamadas: [string, string, unknown][] = [];
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    llamadas.push([init?.method ?? 'GET', url.replace(/^.*\/api\/v1/, ''), init?.body]);
    return Promise.resolve(new Response(JSON.stringify({ data: [], error: null, meta: null })));
  });
  return () => llamadas;
}

afterEach(() => vi.unstubAllGlobals());

describe('servicios de usuarios internos (C10)', () => {
  it('llaman a las rutas de administracion y temario', async () => {
    const llamadas = capturarFetch();
    const datos = { nombre: 'Ana', correo: 'ana@ejemplo.cl', rol: 'admin' as const };

    await listarUsuariosInternos();
    await listarAreas();
    await crearUsuarioInterno({ ...datos, areas: [], contrasena: 'clave-inicial' });
    await editarUsuarioInterno('3', { nombre: 'Ana B.' });
    await cambiarEstadoUsuarioInterno('3', false);
    await cambiarEstadoUsuarioInterno('3', true);

    expect(llamadas()).toEqual([
      ['GET', '/admin/administracion/usuarios-internos', undefined],
      ['GET', '/admin/temario/areas', undefined],
      [
        'POST',
        '/admin/administracion/usuarios-internos',
        JSON.stringify({ ...datos, areas: [], contrasena: 'clave-inicial' }),
      ],
      ['PATCH', '/admin/administracion/usuarios-internos/3', '{"nombre":"Ana B."}'],
      ['POST', '/admin/administracion/usuarios-internos/3/desactivar', undefined],
      ['POST', '/admin/administracion/usuarios-internos/3/activar', undefined],
    ]);
  });
});
