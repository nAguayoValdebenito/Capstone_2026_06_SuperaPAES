export interface ParametroConfiguracion {
  clave: string;
  nombre: string;
  descripcion: string;
  valor: unknown;
  unidad: string;
  editable: boolean;
  regla: string;
  actualizadoEn: string;
  actualizadoPor: string | null;
}

export interface DatosConfiguracion {
  parametros: ParametroConfiguracion[];
}
