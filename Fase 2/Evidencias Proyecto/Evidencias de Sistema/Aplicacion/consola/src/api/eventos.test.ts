// @vitest-environment jsdom
// Una petición que escribe y termina bien avisa a la consola (para refrescar los contadores del menú);
// una de lectura, o una que falla, no.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configurarToken, EVENTO_DATOS_CAMBIADOS, solicitarAdmin } from './cliente';

const respuesta = (estado: number, cuerpo: unknown) =>
  vi.fn(() => Promise.resolve(new Response(JSON.stringify(cuerpo), { status: estado })));

function escuchar() {
  const avisos = vi.fn();
  window.addEventListener(EVENTO_DATOS_CAMBIADOS, avisos);
  return avisos;
}

afterEach(() => {
  vi.unstubAllGlobals();
  configurarToken(() => null);
});

describe('aviso de datos cambiados', () => {
  it('se emite tras una escritura exitosa', async () => {
    configurarToken(() => 'token');
    vi.stubGlobal('fetch', respuesta(200, { data: {}, error: null, meta: null }));
    const avisos = escuchar();
    await solicitarAdmin('/preguntas/avisos/1', { method: 'PATCH', body: '{}' });
    expect(avisos).toHaveBeenCalledTimes(1);
    window.removeEventListener(EVENTO_DATOS_CAMBIADOS, avisos);
  });

  it('no se emite en una lectura ni en una escritura que falla', async () => {
    configurarToken(() => 'token');
    const avisos = escuchar();
    vi.stubGlobal('fetch', respuesta(200, { data: [], error: null, meta: null }));
    await solicitarAdmin('/preguntas');
    vi.stubGlobal(
      'fetch',
      respuesta(409, { data: null, error: { codigo: 'CONFLICTO', mensaje: 'No.' }, meta: null }),
    );
    await expect(solicitarAdmin('/preguntas/1/publicar', { method: 'POST' })).rejects.toThrow();
    expect(avisos).not.toHaveBeenCalled();
    window.removeEventListener(EVENTO_DATOS_CAMBIADOS, avisos);
  });
});
