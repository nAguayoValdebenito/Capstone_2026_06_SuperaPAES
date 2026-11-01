import { afterEach, describe, expect, it, vi } from 'vitest';
import { responderUnaVez } from '../pruebas/sesion';
import {
  consultaDelBanco,
  importarPreguntas,
  listarBanco,
  obtenerFiltrosBanco,
  revisarImportacion,
} from './preguntas';

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

describe('servicios de la importación (C04, HU-13.2)', () => {
  /** El método, la ruta y el cuerpo de la única llamada a la API. */
  function llamada() {
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    return {
      metodo: init?.method,
      ruta: (url as string).replace(/^.*\/api\/v1/, ''),
      cuerpo: JSON.parse(init?.body as string) as unknown,
    };
  }

  const archivos = {
    preguntas: { nombre: 'preguntas.csv', contenido: 'prueba;eje' },
    textos: null,
  };

  it('revisa los archivos sin declarar el origen', async () => {
    responderUnaVez({ data: { porCrear: 1 }, error: null, meta: null });

    expect(await revisarImportacion(archivos)).toEqual({ porCrear: 1 });
    expect(llamada()).toEqual({
      metodo: 'POST',
      ruta: '/admin/preguntas/importaciones/revision',
      cuerpo: archivos,
    });
  });

  it('importa los mismos archivos con la declaración del origen (RN-29)', async () => {
    responderUnaVez({ data: { id: 4, porCrear: 1 }, error: null, meta: null });

    expect(await importarPreguntas(archivos)).toEqual({ id: 4, porCrear: 1 });
    expect(llamada()).toEqual({
      metodo: 'POST',
      ruta: '/admin/preguntas/importaciones',
      cuerpo: { ...archivos, declaraOrigen: true },
    });
  });
});
