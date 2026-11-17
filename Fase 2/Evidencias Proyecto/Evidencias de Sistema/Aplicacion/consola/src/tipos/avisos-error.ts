// Avisos de error de los estudiantes y anulación de preguntas (C13, HU-50): lo que entregan
// /api/v1/admin/preguntas/avisos, /preguntas/:id/anulacion y /evaluaciones/preguntas/:id/impacto.
import type { Opcion, Paginacion } from './index';

/** Un aviso, sin datos del estudiante que lo envió. */
export interface AvisoDeError {
  id: number;
  /** Versión de la pregunta que vio el estudiante. */
  version: number;
  motivo: Opcion;
  comentario: string;
  estado: Opcion;
  creadoEn: string;
  resueltoEn: string | null;
  /** Nombre del administrador que lo cerró. */
  resueltoPor: string | null;
}

/** Una pregunta de la bandeja con sus avisos que cumplen el filtro. */
export interface PreguntaConAvisos {
  pregunta: {
    id: number;
    /** Comienzo del enunciado, para reconocerla sin abrirla. */
    resumen: string;
    prueba: { id: number; codigo: string; nombre: string };
    contenido: { id: number; nombre: string };
    /** La etapa (solo se anula una publicada) y la versión vigente. */
    estado: Opcion;
    versionActual: number;
  };
  /** Avisos pendientes de la pregunta, cumplan o no el filtro. */
  pendientes: number;
  avisos: AvisoDeError[];
}

export interface PaginaDeAvisos {
  grupos: PreguntaConAvisos[];
  paginacion: Paginacion;
}

export type EstadoFiltroAviso = 'pendiente' | 'resuelto' | 'descartado' | 'todos';

export interface FiltrosAvisos {
  estado: EstadoFiltroAviso;
  /** Código del motivo; vacío es «todos». */
  motivo: string;
}

export type CierreAviso = 'resuelto' | 'descartado';

export interface PreguntaAnulada {
  preguntaId: number;
  estado: Opcion;
  evaluacionesRecalculadas: number;
  avisosCerrados: number;
}

/** Evaluaciones donde aparece la pregunta, antes de anularla. */
export interface ImpactoDeAnular {
  evaluacionesCerradas: number;
  evaluacionesAbiertas: number;
}
