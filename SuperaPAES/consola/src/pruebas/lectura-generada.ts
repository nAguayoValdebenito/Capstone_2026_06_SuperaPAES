import type { LecturaDelLote } from '../servicios/textos-generados';
import type { PreguntaParaEditar } from '../tipos';
import { LETRAS } from '../tipos';
import { CL } from './temario';

export const PRUEBA_LECTORA = {
  ...CL,
  habilidades: [
    { id: 401, nombre: 'Localizar' },
    { id: 402, nombre: 'Interpretar' },
    { id: 403, nombre: 'Evaluar' },
  ],
};

export const preguntaGenerada = (orden: number): PreguntaParaEditar => ({
  id: 70 + orden,
  pruebaId: CL.id,
  ejeId: 20,
  contenidoId: 200,
  habilidadId: 400 + orden,
  tipoPregunta: 'seleccion_multiple',
  dificultadSugerida: 'media',
  estado: { codigo: 'borrador', nombre: 'Borrador' },
  editable: true,
  version: 1,
  origen: 'ia',
  enunciado: `Pregunta sobre la lectura ${String(orden)}`,
  explicacion: 'El texto explica el recorrido del agua.',
  textoEstimuloId: 51,
  ordenEnTexto: orden,
  alternativas: LETRAS.slice(0, 4).map((letra, i) => ({
    id: orden * 10 + i,
    letra,
    texto: `Alternativa ${letra}`,
    esCorrecta: i === 1,
    explicacion: null,
  })),
  actualizadoEn: '2026-11-05T01:00:00.000Z',
});

export const LECTURA_GENERADA: LecturaDelLote = {
  texto: { id: '51', titulo: 'El agua', contenido: 'Texto íntegro de lectura.', imagenUrl: null },
  preguntas: [1, 2, 3].map(preguntaGenerada),
};
