import type { PreguntaSeleccionada, CodigoDificultad } from './evaluaciones.seleccion.tipos.js';

export interface DetalleEstructura {
  ejeId: number | null;
  habilidadId: number | null;
  esElectivo: boolean;
  cantidad: number;
  orden: number;
  disponible: boolean;
}
export interface EstructuraConTiempo {
  id: number;
  pruebaId: number;
  codigo: string;
  cantidad: number;
  duracionMin: number;
  textos: number | null;
  detalles: DetalleEstructura[];
}
export interface CandidataEstructura extends PreguntaSeleccionada {
  ejeId: number;
  habilidadId: number;
  areaId: number;
  dificultad: CodigoDificultad;
  textoId: string | null;
  ordenEnTexto: number | null;
}
export interface GrupoArmado extends DetalleEstructura {
  cupo: number;
  areaElectivoId: number | null;
}
