export interface OpcionPlan {
  id: number;
  codigo: string;
  nombre: string;
}

export interface PlanAdministrable {
  id: number;
  nombre: string;
  alcance: OpcionPlan;
  periodicidad: OpcionPlan;
  precioClp: number;
  productos: { google_play: string; app_store: string };
  activo: boolean;
}

export interface DatosPlanes {
  planes: PlanAdministrable[];
  alcances: OpcionPlan[];
  periodicidades: OpcionPlan[];
}

export interface EdicionPlan {
  nombre: string;
  alcanceId: number;
  periodicidadId: number;
  precioClp: number;
  productos: PlanAdministrable['productos'];
  activo: boolean;
}
