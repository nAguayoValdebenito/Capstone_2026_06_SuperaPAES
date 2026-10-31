import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIMITES_IA } from '../adaptadores/ia/http.js';
import { proveedorReal, sobreDeepSeek, solicitudIa } from './ia-fixtures.js';

const fetchFalso = vi.fn<typeof fetch>();
const erroresRegistrados = vi.fn<(mensaje: string) => void>();
const claveEnCuerpo = 'clave-ficticia-que-no-debe-salir';
beforeEach(() => {
  vi.useFakeTimers();
  fetchFalso.mockReset();
  erroresRegistrados.mockClear();
  vi.stubGlobal('fetch', fetchFalso);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(erroresRegistrados);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('transporte de IA con tiempos acotados', () => {
  it('fija los plazos aprobados y un único reintento global', () => {
    expect(LIMITES_IA).toEqual({
      cabecerasMs: 120000,
      cuerpoMs: 30000,
      esperaReintentoMs: 1500,
      maxReintentos: 1,
      maxTokens: 8192,
    });
  });

  it('aborta las cabeceras a los 120 s sin reintentar', async () => {
    let senal: AbortSignal | undefined;
    fetchFalso.mockImplementation(
      (_url, opciones) =>
        new Promise((_resolver, rechazar) => {
          senal = opciones?.signal ?? undefined;
          senal?.addEventListener('abort', () => rechazar(new Error('Abortado')), { once: true });
        }),
    );
    const observado = expect(
      proveedorReal('deepseek').generarPreguntas(solicitudIa),
    ).rejects.not.toHaveProperty('cause');
    await vi.advanceTimersByTimeAsync(119999);
    expect(senal?.aborted).toBe(false);
    await Promise.all([vi.advanceTimersByTimeAsync(1), observado]);
    expect(senal?.aborted).toBe(true);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborta la lectura detenida del cuerpo a los 30 s después de las cabeceras', async () => {
    let senal: AbortSignal | undefined;
    fetchFalso.mockImplementation((_url, opciones) => {
      senal = opciones?.signal ?? undefined;
      const respuesta = Response.json(sobreDeepSeek());
      vi.spyOn(respuesta, 'text').mockImplementation(
        () =>
          new Promise((_resolver, rechazar) => {
            senal?.addEventListener('abort', () => rechazar(new Error('Abortado')), { once: true });
          }),
      );
      return Promise.resolve(respuesta);
    });
    const observado = expect(
      proveedorReal('deepseek').generarPreguntas(solicitudIa),
    ).rejects.toMatchObject({ codigo: 'IA_NO_DISPONIBLE' });
    await vi.advanceTimersByTimeAsync(29999);
    expect(senal?.aborted).toBe(false);
    await Promise.all([vi.advanceTimersByTimeAsync(1), observado]);
    expect(senal?.aborted).toBe(true);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('espera 1500 ms entre un error de red y el único reintento', async () => {
    fetchFalso
      .mockRejectedValueOnce(new TypeError(claveEnCuerpo))
      .mockResolvedValueOnce(Response.json(sobreDeepSeek()));
    const observado = expect(
      proveedorReal('deepseek').generarPreguntas(solicitudIa),
    ).resolves.toMatchObject({ tokensUsados: 30 });
    await vi.advanceTimersByTimeAsync(1499);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    await Promise.all([vi.advanceTimersByTimeAsync(1), observado]);
    expect(fetchFalso).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reintenta un 5xx y entrega el éxito siguiente', async () => {
    fetchFalso
      .mockResolvedValueOnce(new Response(claveEnCuerpo, { status: 503 }))
      .mockResolvedValueOnce(Response.json(sobreDeepSeek()));
    const observado = expect(
      proveedorReal('deepseek').generarPreguntas(solicitudIa),
    ).resolves.toMatchObject({ proveedor: 'deepseek' });
    await Promise.all([vi.runAllTimersAsync(), observado]);
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it('agota dos fallos de red con un error propio y sin causas externas', async () => {
    fetchFalso.mockRejectedValue(new TypeError(claveEnCuerpo));
    const observado = expect(
      proveedorReal('deepseek').generarPreguntas(solicitudIa),
    ).rejects.not.toHaveProperty('cause');
    await Promise.all([vi.runAllTimersAsync(), observado]);
    expect(fetchFalso).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(erroresRegistrados.mock.calls)).not.toContain(claveEnCuerpo);
  });

  it.each([400, 401, 404, 429, 503])(
    'sanitiza HTTP %i y registra solo proveedor y estado',
    async (estado) => {
      fetchFalso.mockImplementation(() =>
        Promise.resolve(
          new Response(`${claveEnCuerpo} ${solicitudIa.instruccion}`, { status: estado }),
        ),
      );
      const ejecucion = proveedorReal('deepseek')
        .generarPreguntas(solicitudIa)
        .catch((error: unknown) => error);
      await vi.runAllTimersAsync();
      const error: unknown = await ejecucion;
      expect(error).toMatchObject({ codigo: 'IA_NO_DISPONIBLE' });
      expect(error).not.toHaveProperty('cause');
      expect(fetchFalso).toHaveBeenCalledTimes(estado >= 500 ? 2 : 1);
      expect(erroresRegistrados).toHaveBeenCalledWith(
        expect.stringContaining(`"estadoHttp":${String(estado)}`),
      );
      const salida = JSON.stringify({ error, logs: erroresRegistrados.mock.calls });
      expect(salida).not.toContain(claveEnCuerpo);
      expect(salida).not.toContain(solicitudIa.instruccion);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('no sigue una redirección que pudiera exponer las credenciales', async () => {
    fetchFalso.mockResolvedValue(
      new Response(null, { status: 302, headers: { location: 'https://otro.ejemplo/' } }),
    );
    await expect(proveedorReal('deepseek').generarPreguntas(solicitudIa)).rejects.toMatchObject({
      codigo: 'IA_NO_DISPONIBLE',
    });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(fetchFalso.mock.calls[0]?.[1]?.redirect).toBe('error');
  });

  it('un 402 de DeepSeek no consume un reintento y representa saldo agotado', async () => {
    fetchFalso.mockResolvedValue(new Response(claveEnCuerpo, { status: 402 }));
    await expect(proveedorReal('deepseek').generarPreguntas(solicitudIa)).rejects.toMatchObject({
      codigo: 'IA_SALDO_AGOTADO',
    });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });
});
