// HU-07.1 (RF-A18, CP-26): las evaluaciones del estudiante para descargar sus datos, de la más antigua
// a la más reciente, con su resultado y sus respuestas. La pide el módulo privacidad.
import type { Ejecutor } from '../../db/transaccion.js';
import {
  crearExportacionRepositorio,
  type FilaEvaluacionExportada,
  type FilaRespuestaExportada,
} from './evaluaciones.exportacion.repositorio.js';

export interface EvaluacionExportada {
  id: string;
  tipo: string;
  prueba: { codigo: string; nombre: string };
  estado: string;
  iniciadaEn: Date;
  cerradaEn: Date | null;
  cantidadPreguntas: number;
  resultado: {
    correctas: number;
    incorrectas: number;
    omitidas: number;
    porcentaje: number;
    puntaje: number | null;
    tiempoUsadoSeg: number;
  } | null;
  respuestas: Omit<FilaRespuestaExportada, 'evaluacionId'>[];
}

export interface ExportacionEvaluaciones {
  exportarEvaluaciones(estudianteId: string): Promise<EvaluacionExportada[]>;
}

function aExportada(
  fila: FilaEvaluacionExportada,
  respuestas: FilaRespuestaExportada[],
): EvaluacionExportada {
  const { pruebaCodigo, pruebaNombre, correctas, incorrectas, omitidas, porcentaje } = fila;
  const { puntaje, tiempoUsadoSeg, id, tipo, estado, iniciadaEn, cerradaEn } = fila;
  const calculado =
    correctas !== null && incorrectas !== null && omitidas !== null && porcentaje !== null;
  return {
    id,
    tipo,
    prueba: { codigo: pruebaCodigo, nombre: pruebaNombre },
    estado,
    iniciadaEn,
    cerradaEn,
    cantidadPreguntas: fila.cantidadPreguntas,
    resultado: calculado
      ? {
          correctas,
          incorrectas,
          omitidas,
          porcentaje,
          puntaje,
          tiempoUsadoSeg: tiempoUsadoSeg ?? 0,
        }
      : null,
    respuestas: respuestas
      .filter((respuesta) => respuesta.evaluacionId === fila.id)
      .map(({ evaluacionId: _, ...respuesta }) => respuesta),
  };
}

export function crearExportacionEvaluaciones(bd: Ejecutor): ExportacionEvaluaciones {
  const repositorio = crearExportacionRepositorio(bd);
  return {
    exportarEvaluaciones: async (estudianteId) => {
      const evaluaciones = await repositorio.evaluaciones(estudianteId);
      const respuestas = await repositorio.respuestas(estudianteId);
      return evaluaciones.map((fila) => aExportada(fila, respuestas));
    },
  };
}
