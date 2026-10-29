import { ProveedorIADeepSeek } from '../adaptadores/ia/deepseek.js';
import { ProveedorIAGemini } from '../adaptadores/ia/gemini.js';

export const solicitudIa = { instruccion: 'Una pregunta ficticia sobre ecuaciones, en JSON.' };
export const preguntaIa = {
  enunciado: '¿Cuánto es $2+2$?',
  alternativas: [{ letra: 'A', texto: '4', esCorrecta: true, explicacion: 'Suma.' }],
  explicacion: 'Se suman dos y dos.',
  dificultadSugerida: 'facil',
};
export const contenidoIa = JSON.stringify({ preguntas: [preguntaIa] });

export function sobreDeepSeek(contenido: string | null = contenidoIa, fin = 'stop') {
  return {
    model: 'modelo-deepseek-prueba',
    choices: [{ message: { content: contenido }, finish_reason: fin }],
    usage: { prompt_tokens: 12, completion_tokens: 18, total_tokens: 30 },
  };
}

export function sobreGemini(contenido = contenidoIa, fin = 'STOP') {
  return {
    modelVersion: 'modelo-gemini-prueba',
    candidates: [{ content: { parts: [{ text: contenido }] }, finishReason: fin }],
    usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 9, totalTokenCount: 16 },
  };
}

export function proveedorReal(nombre: 'deepseek' | 'gemini') {
  return nombre === 'deepseek'
    ? new ProveedorIADeepSeek({
        claveApi: 'clave-deepseek-ficticia',
        obtenerModeloPrincipal: () => Promise.resolve('modelo-deepseek-prueba'),
      })
    : new ProveedorIAGemini({ claveApi: 'clave-gemini-ficticia', modelo: 'modelo-gemini-prueba' });
}
