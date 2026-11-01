// Lo que se pide a la IA y lo que se acepta de vuelta (HU-16.2 y HU-16.5), igual en DeepSeek y en Gemini:
// la temperatura de cada proveedor, el esquema de la prueba, los campos obligatorios y el límite de bytes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esquemaJsonPreguntas } from '../adaptadores/ia/respuesta.js';
import {
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
});
afterEach(() => {
  vi.unstubAllGlobals();
});

interface CuerpoEnviado {
  temperature?: number;
  generationConfig?: { temperature?: number; responseJsonSchema?: unknown };
  messages?: { content: string }[];
}

const cuerpoEnviado = () => {
  const [, opciones] = fetchFalso.mock.calls[0] ?? [];
  return JSON.parse(opciones?.body as string) as CuerpoEnviado;
};

describe.each(['deepseek', 'gemini'] as const)('IA %s: pedido y tamaño', (nombre) => {
  const sobre = nombre === 'deepseek' ? sobreDeepSeek : sobreGemini;

  it('envía la temperatura de su proveedor y no la del otro', async () => {
    fetchFalso.mockResolvedValue(Response.json(sobre()));
    await proveedorReal(nombre).generarPreguntas({
      ...solicitudIa,
      temperaturas: { deepseek: 0.4, gemini: 0.9 },
    });
    const cuerpo = cuerpoEnviado();
    expect(nombre === 'deepseek' ? cuerpo.temperature : cuerpo.generationConfig?.temperature).toBe(
      nombre === 'deepseek' ? 0.4 : 0.9,
    );
  });

  it('sin temperaturas en la solicitud no manda ninguna', async () => {
    fetchFalso.mockResolvedValue(Response.json(sobre()));
    await proveedorReal(nombre).generarPreguntas(solicitudIa);
    const cuerpo = cuerpoEnviado();
    expect(cuerpo).not.toHaveProperty('temperature');
    expect(cuerpo.generationConfig ?? {}).not.toHaveProperty('temperature');
  });

  it('describe al modelo el esquema de la prueba: resolución primero, alternativas y habilidades', async () => {
    fetchFalso.mockResolvedValue(Response.json(sobre()));
    const formato = { alternativas: 4, habilidades: ['RP', 'MOD'] };
    await proveedorReal(nombre).generarPreguntas({ ...solicitudIa, formato });
    const cuerpo = cuerpoEnviado();
    const instruccion = cuerpo.messages?.[0]?.content ?? '';
    const esquema =
      nombre === 'gemini'
        ? cuerpo.generationConfig?.responseJsonSchema
        : (JSON.parse(instruccion.slice(instruccion.indexOf('{'))) as unknown);
    expect(esquema).toEqual(esquemaJsonPreguntas(formato));
  });

  it('rechaza una propuesta sin resolución o sin habilidad, sin reintento', async () => {
    // JSON.stringify omite las claves undefined: es lo mismo que no enviarlas.
    const sinResolucion = { ...preguntaIa, resolucion: undefined };
    const sinHabilidad = { ...preguntaIa, habilidad: undefined };
    for (const pregunta of [sinResolucion, sinHabilidad]) {
      fetchFalso.mockReset();
      fetchFalso.mockResolvedValue(Response.json(sobre(JSON.stringify({ preguntas: [pregunta] }))));
      await expect(proveedorReal(nombre).generarPreguntas(solicitudIa)).rejects.toMatchObject({
        codigo: 'IA_RESPUESTA_INVALIDA',
      });
      expect(fetchFalso).toHaveBeenCalledTimes(1);
    }
  });

  it('rechaza una respuesta que supera el límite de bytes, sin reintento', async () => {
    fetchFalso.mockResolvedValue(new Response(JSON.stringify(sobre('x'.repeat(300_000)))));
    await expect(proveedorReal(nombre).generarPreguntas(solicitudIa)).rejects.toMatchObject({
      codigo: 'IA_RESPUESTA_INVALIDA',
      estadoHttp: 502,
    });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('corta la lectura de una respuesta sin fin en cuanto pasa el límite', async () => {
    let enviados = 0;
    let cancelado = false;
    const flujo = new ReadableStream<Uint8Array>({
      pull(controlador) {
        enviados += 1;
        controlador.enqueue(new Uint8Array(64 * 1024));
      },
      cancel() {
        cancelado = true;
      },
    });
    fetchFalso.mockResolvedValue(new Response(flujo));
    await expect(proveedorReal(nombre).generarPreguntas(solicitudIa)).rejects.toMatchObject({
      codigo: 'IA_RESPUESTA_INVALIDA',
    });
    expect(cancelado).toBe(true);
    expect(enviados).toBeLessThan(20);
  });

  it('rechaza de entrada una respuesta que declara un tamaño mayor al límite', async () => {
    fetchFalso.mockResolvedValue(
      new Response('{}', { headers: { 'Content-Length': String(10_000_000) } }),
    );
    await expect(proveedorReal(nombre).generarPreguntas(solicitudIa)).rejects.toMatchObject({
      codigo: 'IA_RESPUESTA_INVALIDA',
    });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });
});
