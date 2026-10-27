import { afterEach, describe, expect, it, vi } from 'vitest';
import { consultaDelBanco, listarBanco, obtenerFiltrosBanco } from './preguntas';

function responder(cuerpo: unknown) {
  const urls: string[] = [];
  vi.stubGlobal('fetch', (url: string) => {
    urls.push(url.replace(/^.*\/api\/v1/, ''));
    return Promise.resolve(new Response(JSON.stringify(cuerpo)));
  });
  return urls;
}

afterEach(() => vi.unstubAllGlobals());

describe('servicios del banco de preguntas (C02)', () => {
  it('arma la consulta solo con los filtros elegidos y la página', () => {
    expect(consultaDelBanco({}, 1)).toBe('');
    expect(consultaDelBanco({ prueba: 2, eje: 10, origen: 'ia' }, 1)).toBe(
      '?prueba=2&eje=10&origen=ia',
    );
    expect(consultaDelBanco({ estado: 'borrador', dificultad: 'media' }, 3)).toBe(
      '?estado=borrador&dificultad=media&pagina=3',
    );
  });

  it('lista el banco con la paginación de meta', async () => {
    const urls = responder({
      data: [],
      error: null,
      meta: { pagina: 2, porPagina: 20, total: 25 },
    });

    const resultado = await listarBanco({ contenido: 100 }, 2);

    expect(urls).toEqual(['/admin/preguntas?contenido=100&pagina=2']);
    expect(resultado).toEqual({
      preguntas: [],
      paginacion: { pagina: 2, porPagina: 20, total: 25 },
    });
  });

  it('pide las opciones de los filtros', async () => {
    const opciones = { pruebas: [], estados: [], origenes: [], dificultades: [] };
    const urls = responder({ data: opciones, error: null, meta: null });

    expect(await obtenerFiltrosBanco()).toEqual(opciones);
    expect(urls).toEqual(['/admin/preguntas/filtros']);
  });
});
