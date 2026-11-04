import type { DatosPlanes, PlanAdministrable } from '../tipos/planes';

export const planDePrueba: PlanAdministrable = {
  id: 19,
  nombre: 'Una prueba mensual',
  precioClp: 1990,
  activo: true,
  alcance: { id: 23, codigo: 'una_prueba', nombre: 'Una prueba' },
  periodicidad: { id: 31, codigo: 'mensual', nombre: 'Mensual' },
  productos: { google_play: 'una_prueba_mensual', app_store: 'una_prueba_mensual' },
};

export const datosPlanes: DatosPlanes = {
  planes: [planDePrueba],
  alcances: [planDePrueba.alcance],
  periodicidades: [planDePrueba.periodicidad],
};
