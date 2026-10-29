import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FabricaProveedores } from '../adaptadores/fabrica.js';
import { contenidoIa, preguntaIa, sobreDeepSeek, sobreGemini, solicitudIa } from './ia-fixtures.js';

const fetchFalso = vi.fn<typeof fetch>();
const eventos = vi.fn<(mensaje: string) => void>();
beforeEach(() => {
  vi.useFakeTimers();
  fetchFalso.mockReset();
  eventos.mockClear();
  vi.stubGlobal('fetch', fetchFalso);
  vi.spyOn(console, 'log').mockImplementation(eventos);
  vi.spyOn(console, 'error').mockImplementation(eventos);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const crear = (conRespaldo = true) =>
  FabricaProveedores.ia(
    {
      proveedor: 'deepseek',
      claveApi: 'principal-ficticia',
      ...(conRespaldo && { respaldo: { claveApi: 'respaldo-ficticia', modelo: 'gemini-prueba' } }),
    },
    () => Promise.resolve('deepseek-prueba'),
  );

describe('respaldo exclusivo de DeepSeek por falta de saldo', () => {
  it('402 usa Gemini y entrega su proveedor, modelo y uso, con la misma instrucción', async () => {
    fetchFalso
      .mockResolvedValueOnce(new Response('Insufficient Balance', { status: 402 }))
      .mockResolvedValueOnce(Response.json(sobreGemini()));
    const resultado = await crear().generarPreguntas(solicitudIa);
    expect(resultado).toEqual({
      proveedor: 'gemini',
      modelo: 'modelo-gemini-prueba',
      preguntas: [preguntaIa],
      tokensUsados: 16,
      usoTokens: { entrada: 7, salida: 9, total: 16 },
    });
    expect(fetchFalso).toHaveBeenCalledTimes(2);
    const segunda = fetchFalso.mock.calls[1]?.[1];
    expect(new Headers(segunda?.headers).get('x-goog-api-key')).toBe('respaldo-ficticia');
    expect(segunda?.body).toContain(solicitudIa.instruccion);
    expect(eventos).toHaveBeenCalledWith(expect.stringContaining('"causa":"saldo_agotado"'));
    const logs = eventos.mock.calls.flat().join('\n');
    for (const dato of [
      'principal-ficticia',
      'respaldo-ficticia',
      solicitudIa.instruccion,
      contenidoIa,
    ]) {
      expect(logs).not.toContain(dato);
    }
  });

  it('402 sin clave de respaldo devuelve saldo agotado sin otra petición', async () => {
    fetchFalso.mockResolvedValue(new Response('Insufficient Balance', { status: 402 }));
    await expect(crear(false).generarPreguntas(solicitudIa)).rejects.toMatchObject({
      codigo: 'IA_SALDO_AGOTADO',
    });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it.each([400, 401, 404, 429, 500, 503])(
    'HTTP %i nunca activa Gemini ni filtra el cuerpo',
    async (estado) => {
      fetchFalso.mockImplementation(() =>
        Promise.resolve(
          new Response(`principal-ficticia respaldo-ficticia ${solicitudIa.instruccion}`, {
            status: estado,
          }),
        ),
      );
      const espera = expect(crear().generarPreguntas(solicitudIa)).rejects.toMatchObject({
        codigo: 'IA_NO_DISPONIBLE',
      });
      await Promise.all([vi.runAllTimersAsync(), espera]);
      expect(fetchFalso).toHaveBeenCalledTimes(estado >= 500 ? 2 : 1);
      for (const [url] of fetchFalso.mock.calls)
        expect(url).toBe('https://api.deepseek.com/chat/completions');
      const logs = eventos.mock.calls.flat().join('\n');
      expect(logs).toContain(`"estadoHttp":${String(estado)}`);
      for (const dato of ['principal-ficticia', 'respaldo-ficticia', solicitudIa.instruccion])
        expect(logs).not.toContain(dato);
    },
  );

  it('JSON inválido no activa el respaldo', async () => {
    fetchFalso.mockResolvedValue(Response.json(sobreDeepSeek('no es JSON')));
    await expect(crear().generarPreguntas(solicitudIa)).rejects.toMatchObject({
      codigo: 'IA_RESPUESTA_INVALIDA',
    });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('dos contenidos vacíos fallan sin Gemini', async () => {
    fetchFalso.mockImplementation(() => Promise.resolve(Response.json(sobreDeepSeek(''))));
    const espera = expect(crear().generarPreguntas(solicitudIa)).rejects.toMatchObject({
      codigo: 'IA_RESPUESTA_INVALIDA',
    });
    await Promise.all([vi.runAllTimersAsync(), espera]);
    expect(fetchFalso).toHaveBeenCalledTimes(2);
    expect(
      fetchFalso.mock.calls.every(([url]) => url === 'https://api.deepseek.com/chat/completions'),
    ).toBe(true);
  });

  it('timeout no activa el respaldo', async () => {
    fetchFalso.mockImplementation(
      (_url, opciones) =>
        new Promise((_resolver, rechazar) => {
          opciones?.signal?.addEventListener('abort', () => rechazar(new Error('Abortado')), {
            once: true,
          });
        }),
    );
    const espera = expect(crear().generarPreguntas(solicitudIa)).rejects.toMatchObject({
      codigo: 'IA_NO_DISPONIBLE',
    });
    await Promise.all([vi.runAllTimersAsync(), espera]);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('el error de Gemini se devuelve sin ciclos de respaldo', async () => {
    fetchFalso
      .mockResolvedValueOnce(new Response(null, { status: 402 }))
      .mockResolvedValueOnce(new Response('respaldo-ficticia', { status: 401 }));
    await expect(crear().generarPreguntas(solicitudIa)).rejects.toMatchObject({
      codigo: 'IA_NO_DISPONIBLE',
    });
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it('el respaldo no obtiene un reintento adicional si DeepSeek ya lo consumió', async () => {
    fetchFalso
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 402 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    const espera = expect(crear().generarPreguntas(solicitudIa)).rejects.toMatchObject({
      codigo: 'IA_NO_DISPONIBLE',
    });
    await Promise.all([vi.runAllTimersAsync(), espera]);
    expect(fetchFalso).toHaveBeenCalledTimes(3);
  });

  it('un 402 deja disponible el único reintento para un vacío de Gemini', async () => {
    fetchFalso
      .mockResolvedValueOnce(new Response(null, { status: 402 }))
      .mockResolvedValueOnce(Response.json(sobreGemini('')))
      .mockResolvedValueOnce(Response.json(sobreGemini()));
    const espera = expect(crear().generarPreguntas(solicitudIa)).resolves.toMatchObject({
      proveedor: 'gemini',
    });
    await Promise.all([vi.runAllTimersAsync(), espera]);
    expect(fetchFalso).toHaveBeenCalledTimes(3);
  });

  it('limita toda la cadena a unos cinco minutos incluso con reintento y respaldo', async () => {
    fetchFalso
      .mockImplementationOnce(
        () =>
          new Promise((resolver) =>
            setTimeout(() => resolver(new Response(null, { status: 503 })), 119000),
          ),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolver) =>
            setTimeout(() => resolver(new Response(null, { status: 402 })), 119000),
          ),
      )
      .mockImplementationOnce(
        (_url, opciones) =>
          new Promise((_resolver, rechazar) => {
            opciones?.signal?.addEventListener('abort', () => rechazar(new Error('Abortado')), {
              once: true,
            });
          }),
      );
    const inicio = Date.now();
    const espera = expect(crear().generarPreguntas(solicitudIa)).rejects.toMatchObject({
      codigo: 'IA_NO_DISPONIBLE',
    });
    await Promise.all([vi.runAllTimersAsync(), espera]);
    expect(Date.now() - inicio).toBe(301500);
    expect(fetchFalso).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });
});
