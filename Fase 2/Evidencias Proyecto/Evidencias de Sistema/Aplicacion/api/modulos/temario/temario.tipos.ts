/** Contenido o habilidad del temario: un id y su nombre. */
export interface ContenidoTemario {
  id: number;
  nombre: string;
}

export interface EjeTemario {
  id: number;
  nombre: string;
  contenidos: ContenidoTemario[];
}

/** Tipo de pregunta que admite una prueba. */
export interface TipoPreguntaTemario {
  codigo: string;
  nombre: string;
}

/** Prueba con sus ejes, habilidades y tipos de pregunta, en el orden del temario. */
export interface PruebaTemario {
  id: number;
  codigo: string;
  nombre: string;
  opcionesMin: number;
  opcionesMax: number;
  requiereTexto: boolean;
  ejes: EjeTemario[];
  habilidades: ContenidoTemario[];
  tiposPregunta: TipoPreguntaTemario[];
}
