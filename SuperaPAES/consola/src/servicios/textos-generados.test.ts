import { afterEach, describe, expect, it, vi } from 'vitest';
import { configurarToken } from '../api/cliente';
import { LECTURA_GENERADA, preguntaGenerada } from '../pruebas/lectura-generada';
import { obtenerLecturasDelLote } from './textos-generados';

function servidor(preguntas = [preguntaGenerada(3), preguntaGenerada(1), preguntaGenerada(2)]) {
  const consulta = vi.fn((url: string, opciones?: RequestInit) => {
    const { pathname, searchParams } = new URL(url);
    let data: unknown;
    let meta: unknown = null;
    if (pathname.endsWith('/preguntas')) {
      const pagina = Number(searchParams.get('pagina') ?? 1);
      data = preguntas.slice(pagina - 1, pagina).map(({ id }) => ({ id }));
      meta = { pagina, porPagina: 1, total: preguntas.length };
    } else if (pathname.includes('/textos/')) {
      data = LECTURA_GENERADA.texto;
    } else {
      data = preguntas.find(({ id }) => pathname.endsWith(`/${String(id)}`));
    }
    return opciones?.signal?.aborted
      ? Promise.reject(new DOMException('Cancelada', 'AbortError'))
      : Promise.resolve(new Response(JSON.stringify({ data, error: null, meta })));
  });
  vi.stubGlobal('fetch', consulta);
  return consulta;
}

afterEach(() => {
  vi.unstubAllGlobals();
  configurarToken(() => null);
});

describe('HU-18.3, CP-14: recuperar texto y preguntas del lote', () => {
  it('consulta solo ese lote, recorre las páginas, comparte el texto y ordena las preguntas', async () => {
    const consulta = servidor();
    const senal = new AbortController().signal;
    const lecturas = await obtenerLecturasDelLote('32', senal);

    expect(lecturas).toEqual([LECTURA_GENERADA]);
    const llamadas = consulta.mock.calls.map(([url]) => new URL(url));
    const listas = llamadas.filter(({ pathname }) => pathname.endsWith('/preguntas'));
    expect(listas).toHaveLength(3);
    expect(listas.every(({ searchParams }) => searchParams.get('lote') === '32')).toBe(true);
    expect(listas.every(({ searchParams }) => !searchParams.has('estado'))).toBe(true);
    expect(llamadas.filter(({ pathname }) => pathname.endsWith('/textos/51'))).toHaveLength(1);
    expect(consulta.mock.calls.every(([, opciones]) => opciones?.signal === senal)).toBe(true);
    expect(consulta.mock.calls.every(([, opciones]) => !opciones?.method)).toBe(true);
  });

  it('un lote sin preguntas no intenta cargar textos ajenos', async () => {
    const consulta = servidor([]);
    expect(await obtenerLecturasDelLote('33', new AbortController().signal)).toEqual([]);
    expect(consulta).toHaveBeenCalledTimes(1);
  });

  it('avisa si una pregunta perdió su relación con el texto', async () => {
    servidor([{ ...preguntaGenerada(1), textoEstimuloId: null }]);
    await expect(obtenerLecturasDelLote('32', new AbortController().signal)).rejects.toThrow(
      'texto de lectura',
    );
  });

  it('la cancelación interrumpe la consulta antes de cargar preguntas o textos', async () => {
    const consulta = servidor();
    const control = new AbortController();
    control.abort();
    await expect(obtenerLecturasDelLote('32', control.signal)).rejects.toThrow('Cancelada');
    expect(consulta).toHaveBeenCalledTimes(1);
  });

  it.each(['preguntas', 'preguntas/73', 'preguntas/textos/51'])(
    'propaga un error al consultar %s para mostrarlo y permitir reintentar',
    async (ruta) => {
      const consulta = servidor();
      const responder = consulta.getMockImplementation()!;
      consulta.mockImplementation((url, opciones) => {
        if (new URL(url).pathname.endsWith(`/admin/${ruta}`)) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: null,
                error: { codigo: 'FALLA_PRUEBA', mensaje: 'No se pudo cargar la lectura.' },
                meta: null,
              }),
              { status: 500 },
            ),
          );
        }
        return responder(url, opciones);
      });
      await expect(obtenerLecturasDelLote('32', new AbortController().signal)).rejects.toThrow(
        'No se pudo cargar la lectura.',
      );
    },
  );
});
