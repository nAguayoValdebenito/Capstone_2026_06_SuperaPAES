// C06 · Revisiones (HU-21 y HU-23): lo que entrega GET /admin/revision/seguimiento.
import type { Paginacion } from './index';

export type GrupoSeguimiento = 'en_curso' | 'en_desempate' | 'vencidas' | 'terminadas';

export interface DocenteSeguido {
  correo: string;
  estado: string;
  decision: string | null;
  dificultad: string | null;
}

export interface PreguntaSeguida {
  id: number;
  prueba: string;
  contenido: string;
  estado: { codigo: string; nombre: string };
  posibleConfusa: boolean;
  revisores: DocenteSeguido[];
  desempate: DocenteSeguido | null;
  venceEn: string | null;
}

export interface VistaSeguimiento {
  preguntas: PreguntaSeguida[];
  conteos: Record<GrupoSeguimiento, number>;
  sinDocentes: { area: string; preguntas: number }[];
  plazoDias: number;
}

export interface PaginaSeguimiento {
  seguimiento: VistaSeguimiento;
  paginacion: Paginacion;
}
