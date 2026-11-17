// HU-18.1: los proveedores de IA también generan un texto de lectura (título y contenido), con su propio esquema,
// antes de pedir las preguntas que se apoyan en él. Igual en DeepSeek y en Gemini, y en el simulado.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProveedorIASimulado } from '../adaptadores/ia/simulado.js';
import { esquemaJsonTexto } from '../adaptadores/ia/respuesta.js';
import { proveedorReal, sobreDeepSeek, sobreGemini, solicitudIa } from './ia-fixtures.js';

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

const textoIa = {
  titulo: 'El río y la ciudad',
  contenido: 'Era una ciudad antigua junto al río. '.repeat(20),
};
const solicitudDeTexto = { ...solicitudIa, salida: 'texto' as const };

interface CuerpoEnviado {
  messages?: { content: string }[];
  generationConfig?: { responseJsonSchema?: unknown };
}

const cuerpoEnviado = () => {
  const [, opciones] = fetchFalso.mock.calls[0] ?? [];
  return JSON.parse(opciones?.body as string) as CuerpoEnviado;
};

describe.each(['deepseek', 'gemini'] as const)('IA %s: texto de lectura', (nombre) => {
  const sobre = (contenido: string) =>
    nombre === 'deepseek' ? sobreDeepSeek(contenido) : sobreGemini(contenido);

  it('pide el esquema del texto (no el de las preguntas) y devuelve el título y el contenido', async () => {
    fetchFalso.mockResolvedValue(Response.json(sobre(JSON.stringify(textoIa))));

    const resultado = await proveedorReal(nombre).generarPreguntas(solicitudDeTexto);

    expect(resultado.texto).toEqual(textoIa);
    expect(resultado.preguntas).toEqual([]);
    const cuerpo = cuerpoEnviado();
    const esquemaEnviado =
      nombre === 'deepseek'
        ? cuerpo.messages?.[0]?.content
        : JSON.stringify(cuerpo.generationConfig?.responseJsonSchema);
    expect(esquemaEnviado).toContain(JSON.stringify(esquemaJsonTexto()));
    expect(esquemaEnviado).not.toContain('"alternativas"');
  });

  it('sin salida pedida sigue entregando preguntas, como antes', async () => {
    fetchFalso.mockResolvedValue(
      Response.json(
        sobre(
          JSON.stringify({
            preguntas: [
              {
                enunciado: '¿Cuánto es $2+2$?',
                resolucion: '$2 + 2 = 4$',
                habilidad: 'RP',
                alternativas: [{ letra: 'A', texto: '4', esCorrecta: true, explicacion: 'Suma.' }],
                explicacion: 'Se suman.',
                dificultadSugerida: 'facil',
              },
            ],
          }),
        ),
      ),
    );

    const resultado = await proveedorReal(nombre).generarPreguntas(solicitudIa);

    expect(resultado.preguntas).toHaveLength(1);
    expect(resultado.texto).toBeUndefined();
  });

  it.each([
    ['sin título', { contenido: 'Texto.' }],
    ['sin contenido', { titulo: 'Título' }],
    ['con un título que no es texto', { titulo: 3, contenido: 'Texto.' }],
    ['con las preguntas en vez del texto', { preguntas: [] }],
  ])('un texto %s es una respuesta no válida de la IA (502)', async (_caso, cuerpoDelTexto) => {
    fetchFalso.mockResolvedValue(Response.json(sobre(JSON.stringify(cuerpoDelTexto))));

    await expect(proveedorReal(nombre).generarPreguntas(solicitudDeTexto)).rejects.toMatchObject({
      codigo: 'IA_RESPUESTA_INVALIDA',
    });
  });

  it('el esquema del texto pide solo el título y el contenido, sin campos de más', () => {
    expect(esquemaJsonTexto()).toMatchObject({
      type: 'object',
      required: ['titulo', 'contenido'],
      additionalProperties: false,
    });
  });
});

describe('IA simulada: texto de lectura', () => {
  it('entrega un texto de ejemplo cuando se lo pide', async () => {
    const resultado = await new ProveedorIASimulado().generarPreguntas(solicitudDeTexto);

    expect(resultado.texto?.titulo).toBeTruthy();
    expect(resultado.texto?.contenido.length).toBeGreaterThan(200);
    expect(resultado.preguntas).toEqual([]);
  });
});
