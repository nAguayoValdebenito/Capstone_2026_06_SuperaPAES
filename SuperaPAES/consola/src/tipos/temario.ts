import type { Area, PruebaTemario } from './index';

export interface ContenidoTemarioConsulta {
  id: number;
  nombre: string;
  area: Area;
  curso: string | null;
  descriptores: string | null;
  activo: boolean;
}

export interface PruebaTemarioConsulta extends Omit<PruebaTemario, 'ejes' | 'habilidades'> {
  ejes: { id: number; nombre: string; contenidos: ContenidoTemarioConsulta[] }[];
  habilidades: { id: number; codigo: string; nombre: string; criterios: string | null }[];
}

export interface ConsultaTemario {
  areas: Area[];
  pruebas: PruebaTemarioConsulta[];
}
