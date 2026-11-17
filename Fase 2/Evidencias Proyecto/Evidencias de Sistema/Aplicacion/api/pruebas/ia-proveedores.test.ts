import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProveedorIADeepSeek } from '../adaptadores/ia/deepseek.js';
import {
  contenidoIa,
  preguntaIa,
  proveedorReal,
  sobreDeepSeek,
  sobreGemini,
  solicitudIa,
} from './ia-fixtures.js';

const fetchFalso = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchFalso.mockReset();
  vi.stubGlobal('fetch', fetchFalso);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe.each(['deepseek', 'gemini'] as const)('IA %s', (nombre) => {
  const sobre = nombre === 'deepseek' ? sobreDeepSeek : sobreGemini;
  it('entrega preguntas tipadas y el uso que informa el proveedor, sin calcular costos', async () => {
    fetchFalso.mockResolvedValue(Response.json(sobre()));
    const resultado = await proveedorReal(nombre).generarPreguntas(solicitudIa);
    expect(resultado).toEqual({
      proveedor: nombre,
      modelo: `modelo-${nombre}-prueba`,
      preguntas: [preguntaIa],
      tokensUsados: nombre === 'deepseek' ? 30 : 16,
      usoTokens:
        nombre === 'deepseek'
          ? { entrada: 12, salida: 18, total: 30 }
          : { entrada: 7, salida: 9, total: 16 },
    });
    expect(resultado).not.toHaveProperty('costoUsd');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('envía solamente la instrucción, el formato JSON y la configuración técnica', async () => {
    fetchFalso.mockResolvedValue(Response.json(sobre()));
    await proveedorReal(nombre).generarPreguntas(solicitudIa);
    const [url, opciones] = fetchFalso.mock.calls[0] ?? [];
    expect(url).not.toContain('clave');
    expect(opciones?.redirect).toBe('error');
    const cabeceras = new Headers(opciones?.headers);
    const cuerpo = JSON.parse(opciones?.body as string) as Record<string, unknown>;
    if (nombre === 'deepseek') {
      expect(url).toBe('https://api.deepseek.com/chat/completions');
      expect(cabeceras.get('Authorization')).toBe('Bearer clave-deepseek-ficticia');
      expect(cuerpo).toMatchObject({
        model: 'modelo-deepseek-prueba',
        max_tokens: 8192,
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
        messages: [
          { role: 'system', content: expect.stringMatching(/JSON/) as string },
          { role: 'user', content: solicitudIa.instruccion },
        ],
      });
      expect(Object.keys(cuerpo).sort()).toEqual([
        'max_tokens',
        'messages',
        'model',
        'response_format',
        'stream',
        'thinking',
      ]);
    } else {
      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/modelo-gemini-prueba:generateContent',
      );
      expect(cabeceras.get('x-goog-api-key')).toBe('clave-gemini-ficticia');
      expect(cuerpo).toMatchObject({
        contents: [{ role: 'user', parts: [{ text: solicitudIa.instruccion }] }],
        systemInstruction: { parts: [{ text: expect.stringMatching(/JSON/) as string }] },
        generationConfig: { maxOutputTokens: 8192, responseMimeType: 'application/json' },
      });
      expect(Object.keys(cuerpo).sort()).toEqual([
        'contents',
        'generationConfig',
        'systemInstruction',
      ]);
    }
  });

  it('no inventa tokens cuando el proveedor no entrega uso', async () => {
    const datos =
      nombre === 'deepseek'
        ? { choices: sobreDeepSeek().choices }
        : { candidates: sobreGemini().candidates };
    fetchFalso.mockResolvedValue(Response.json(datos));
    const resultado = await proveedorReal(nombre).generarPreguntas(solicitudIa);
    expect(resultado).not.toHaveProperty('tokensUsados');
    expect(resultado).not.toHaveProperty('usoTokens');
  });

  // 'no es json' y '{' ya no están aquí: un JSON no analizable se reintenta (ver más abajo). Un JSON válido
  // con la forma equivocada sigue sin reintento: el modelo respondió algo coherente.
  it.each(['{}', '{"preguntas":[{"enunciado":123}]}'])(
    'rechaza contenido inválido sin reintento: %s',
    async (contenido) => {
      fetchFalso.mockResolvedValue(Response.json(sobre(contenido)));
      await expect(proveedorReal(nombre).generarPreguntas(solicitudIa)).rejects.toMatchObject({
        codigo: 'IA_RESPUESTA_INVALIDA',
        estadoHttp: 502,
      });
      expect(fetchFalso).toHaveBeenCalledTimes(1);
    },
  );

  it('rechaza el JSON exterior inválido sin reintento', async () => {
    fetchFalso.mockResolvedValue(new Response('no es json'));
    await expect(proveedorReal(nombre).generarPreguntas(solicitudIa)).rejects.toMatchObject({
      codigo: 'IA_RESPUESTA_INVALIDA',
    });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('reintenta el contenido vacío una vez y luego entrega el resultado', async () => {
    fetchFalso
      .mockResolvedValueOnce(Response.json(sobre('   ')))
      .mockResolvedValueOnce(Response.json(sobre()));
    const espera = expect(
      proveedorReal(nombre).generarPreguntas(solicitudIa),
    ).resolves.toMatchObject({ preguntas: [preguntaIa] });
    await Promise.all([vi.runAllTimersAsync(), espera]);
    expect(fetchFalso).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  // Forma exacta de un fallo real de Gemini (HTTP 200, finishReason STOP): sin la comilla de apertura de
  // "alternativas", con un `$` en su lugar.
  const jsonConComillaPerdida = '{"preguntas":[{"enunciado":"x",$alternativas":[]}]}';

  it.each(['no es json', '{', jsonConComillaPerdida])(
    'reintenta un JSON no analizable una vez y luego entrega el resultado: %s',
    async (malformado) => {
      fetchFalso
        .mockResolvedValueOnce(Response.json(sobre(malformado)))
        .mockResolvedValueOnce(Response.json(sobre()));
      const espera = expect(
        proveedorReal(nombre).generarPreguntas(solicitudIa),
      ).resolves.toMatchObject({ preguntas: [preguntaIa] });
      await Promise.all([vi.runAllTimersAsync(), espera]);
      expect(fetchFalso).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('dos JSON no analizables terminan con respuesta inválida tras un único reintento', async () => {
    fetchFalso.mockImplementation(() =>
      Promise.resolve(Response.json(sobre(jsonConComillaPerdida))),
    );
    const espera = expect(
      proveedorReal(nombre).generarPreguntas(solicitudIa),
    ).rejects.toMatchObject({ codigo: 'IA_RESPUESTA_INVALIDA', estadoHttp: 502 });
    await Promise.all([vi.runAllTimersAsync(), espera]);
    expect(fetchFalso).toHaveBeenCalledTimes(2);
    // Ni el texto del modelo ni las claves llegan a los registros.
    const registrado = JSON.stringify(
      (['log', 'error', 'info'] as const).map((nivel) => vi.spyOn(console, nivel).mock.calls),
    );
    expect(registrado).not.toContain('alternativas');
    expect(registrado).not.toMatch(/clave-(deepseek|gemini)-ficticia/u);
  });

  it('dos contenidos vacíos terminan con respuesta inválida', async () => {
    fetchFalso.mockImplementation(() => Promise.resolve(Response.json(sobre(''))));
    const espera = expect(
      proveedorReal(nombre).generarPreguntas(solicitudIa),
    ).rejects.toMatchObject({ codigo: 'IA_RESPUESTA_INVALIDA' });
    await Promise.all([vi.runAllTimersAsync(), espera]);
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it('rechaza truncamiento aunque el fragmento sea JSON válido, sin reintento', async () => {
    fetchFalso.mockResolvedValue(
      Response.json(sobre(contenidoIa, nombre === 'deepseek' ? 'length' : 'MAX_TOKENS')),
    );
    await expect(proveedorReal(nombre).generarPreguntas(solicitudIa)).rejects.toMatchObject({
      codigo: 'IA_RESPUESTA_INVALIDA',
    });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('no aplica reglas pedagógicas al JSON de forma válida', async () => {
    const preguntas = [{ ...preguntaIa, alternativas: [] }];
    fetchFalso.mockResolvedValue(Response.json(sobre(JSON.stringify({ preguntas }))));
    expect((await proveedorReal(nombre).generarPreguntas(solicitudIa)).preguntas).toEqual(
      preguntas,
    );
  });

  it('un rechazo de seguridad no se convierte en un contenido vacío reintentable', async () => {
    fetchFalso.mockResolvedValue(
      Response.json(
        nombre === 'gemini'
          ? { promptFeedback: { blockReason: 'SAFETY' } }
          : { choices: [{ finish_reason: 'content_filter', message: { content: '' } }] },
      ),
    );
    await expect(proveedorReal(nombre).generarPreguntas(solicitudIa)).rejects.toMatchObject({
      codigo: 'IA_RESPUESTA_INVALIDA',
    });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });
});

it('DeepSeek vuelve a leer el modelo en cada solicitud sin valores fijos en el código', async () => {
  let modelo = 'modelo-uno';
  const proveedor = new ProveedorIADeepSeek({
    claveApi: 'ficticia',
    obtenerModeloPrincipal: () => Promise.resolve(modelo),
  });
  fetchFalso.mockImplementation(() => Promise.resolve(Response.json(sobreDeepSeek())));
  await proveedor.generarPreguntas(solicitudIa);
  modelo = 'modelo-dos';
  await proveedor.generarPreguntas(solicitudIa);
  expect(
    fetchFalso.mock.calls.map(
      ([, opciones]) => (JSON.parse(opciones?.body as string) as { model: string }).model,
    ),
  ).toEqual(['modelo-uno', 'modelo-dos']);
});

// Medido con 20 llamadas reales por variante (sin reintentos): sin esquema, 6 respuestas fallidas de 20
// (5 JSON rotos y 1 de forma inválida); con responseJsonSchema, 0 de 20. Solo Gemini: no se probó con DeepSeek.
describe('Gemini: salida estructurada', () => {
  it('envía el JSON Schema de las preguntas en responseJsonSchema', async () => {
    fetchFalso.mockResolvedValue(Response.json(sobreGemini()));
    await proveedorReal('gemini').generarPreguntas(solicitudIa);
    const [, opciones] = fetchFalso.mock.calls[0] ?? [];
    const cuerpo = JSON.parse(opciones?.body as string) as {
      generationConfig: { responseMimeType: string; responseJsonSchema: Record<string, unknown> };
    };
    const { responseMimeType, responseJsonSchema } = cuerpo.generationConfig;
    expect(responseMimeType).toBe('application/json');
    expect(responseJsonSchema).toMatchObject({
      type: 'object',
      required: ['preguntas'],
      properties: { preguntas: { type: 'array' } },
    });
    // La letra de cada alternativa queda limitada a A-E (RN-08) desde el esquema.
    expect(JSON.stringify(responseJsonSchema)).toContain('"enum":["A","B","C","D","E"]');
  });

  it('DeepSeek no recibe un esquema en la petición', async () => {
    fetchFalso.mockResolvedValue(Response.json(sobreDeepSeek()));
    await proveedorReal('deepseek').generarPreguntas(solicitudIa);
    const [, opciones] = fetchFalso.mock.calls[0] ?? [];
    expect(opciones?.body as string).not.toContain('responseJsonSchema');
    expect(opciones?.body as string).not.toContain('json_schema');
  });
});
