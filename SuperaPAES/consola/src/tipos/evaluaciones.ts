// C08 · Evaluaciones (HU-63, CU-31): lo que entrega /admin/evaluaciones.
export interface FilaReparto {
  id: number;
  nombre: string;
  cantidad: number;
  noPuntuables: number;
}

export interface Estructura {
  id: number;
  tipo: string;
  tipoNombre: string;
  cantidadMin: number;
  cantidadMax: number;
  noPuntuables: number;
  duracionMin: number | null;
  textos: number | null;
  usosGratisMes: number;
  reparto: FilaReparto[];
}

export interface EdicionEstructura {
  cantidadMin: number;
  cantidadMax: number;
  noPuntuables: number;
  duracionMin: number | null;
  textos: number | null;
  usosGratisMes: number;
  reparto: { id: number; cantidad: number }[];
}

export interface TablaConversion {
  id: number;
  anioAdmision: number;
  proceso: string;
  electivoId: number | null;
  electivo: string | null;
  publicadaEn: string;
  filas: number;
  vigente: boolean;
}

export interface OpcionConfiguracion {
  id: number;
  nombre: string;
}

export interface TablasDeLaPrueba {
  tablas: TablaConversion[];
  procesos: OpcionConfiguracion[];
  electivos: OpcionConfiguracion[];
}

export interface FilaConversion {
  correctas: number;
  puntaje: number;
}

export interface NuevaTabla {
  pruebaId: number;
  procesoId: number;
  anioAdmision: number;
  electivoAreaId: number | null;
  publicadaEn: string;
  filas: FilaConversion[];
}
