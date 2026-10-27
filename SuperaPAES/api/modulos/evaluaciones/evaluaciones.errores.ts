// Errores de la práctica y de la respuesta (catálogo de docs/convenciones.md). Cada código vive en un
// solo lugar, así el inicio, la entrega y la respuesta usan siempre el mismo mensaje.
import { ErrorAplicacion, ErrorValidacion } from '../../comun/errores.js';

export function validacion(ruta: string, mensaje: string, motivo: string): ErrorValidacion {
  return new ErrorValidacion([{ lugar: 'cuerpo', ruta, mensaje, motivo }], mensaje);
}

export function sinPreguntas(disponibles: number, solicitadas: number, opciones: string[]) {
  return new ErrorAplicacion(
    409,
    'SIN_PREGUNTAS_SUFICIENTES',
    'No hay suficientes preguntas publicadas para lo elegido.',
    { detalles: { disponibles, solicitadas, opciones } },
  );
}

export const evaluacionConTiempoAbierta = () =>
  new ErrorAplicacion(
    409,
    'EVALUACION_CON_TIEMPO_ABIERTA',
    'Termina tu evaluación con tiempo antes de empezar otra.',
  );

export const evaluacionNoEncontrada = () =>
  new ErrorAplicacion(404, 'EVALUACION_NO_ENCONTRADA', 'La práctica solicitada no existe.');

export const evaluacionCerrada = () =>
  new ErrorAplicacion(409, 'EVALUACION_CERRADA', 'Esta práctica ya está cerrada.');

export const practicaCompleta = () =>
  new ErrorAplicacion(
    409,
    'PRACTICA_COMPLETA',
    'Ya respondiste todas las preguntas. Cierra la práctica para ver tu resumen.',
    { detalles: { accion: 'cerrar' } },
  );

/** El ítem no existe, no es de esa evaluación o no es del estudiante: siempre el mismo mensaje. */
export const itemNoEncontrado = () =>
  new ErrorAplicacion(404, 'ITEM_NO_ENCONTRADO', 'La pregunta no existe en esta práctica.');

export const respuestaYaRegistrada = () =>
  new ErrorAplicacion(
    409,
    'RESPUESTA_YA_REGISTRADA',
    'Ya respondiste esta pregunta. En la práctica la respuesta es definitiva.',
  );

export const alternativaInvalida = () =>
  new ErrorAplicacion(400, 'ALTERNATIVA_INVALIDA', 'Esa alternativa no es de esta pregunta.');
