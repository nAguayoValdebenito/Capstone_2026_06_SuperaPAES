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

/** C09 (HU-64.1): una dificultad con su mezcla global en porcentaje (RN-09). */
export interface DificultadLista {
  codigo: string;
  nombre: string;
  minimo: number;
  objetivo: number;
  maximo: number;
}

/** C09 (HU-64.1): un área de carrera con las pruebas y el electivo que sugiere (RN-25). */
export interface AreaCarreraLista {
  codigo: string;
  nombre: string;
  activa: boolean;
  pruebas: { codigo: string; nombre: string }[];
  electivo: string | null;
}

/** C09 (HU-64.1): opción que solo tiene código, nombre y si se ofrece. */
export interface OpcionLista {
  codigo: string;
  nombre: string;
  activa: boolean;
}

/** C09 (HU-64.1): tipo de evaluación con su modo de armado y su comportamiento. */
export interface TipoEvaluacionLista {
  codigo: string;
  nombre: string;
  modoArmado: string;
  correccionInmediata: boolean;
  permiteCambiarRespuesta: boolean;
  conTiempo: boolean;
  permiteElegirAlcance: boolean;
  permiteElegirDificultad: boolean;
  filtraPorNivel: boolean;
  entregaPuntaje: boolean;
  unicaPorAnioEscolar: boolean;
  consumeCupo: boolean;
  cuentaParaProgreso: boolean;
}

export interface ListasOpciones {
  dificultades: DificultadLista[];
  areasCarrera: AreaCarreraLista[];
  tiposEvaluacion: TipoEvaluacionLista[];
  motivosAviso: OpcionLista[];
  tiposPregunta: OpcionLista[];
  tiposTexto: OpcionLista[];
}
