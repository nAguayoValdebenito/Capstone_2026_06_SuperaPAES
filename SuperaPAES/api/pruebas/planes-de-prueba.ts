import type { Ejecutor } from '../db/transaccion.js';
import type { PlanAdministrable } from '../modulos/suscripciones/suscripciones.planes.repositorio.js';
import { vaciarTablas } from './base-temporal.js';
import type pg from 'pg';

export const PLAN: PlanAdministrable = {
  id: 19,
  nombre: 'Una prueba mensual',
  precioClp: 1990,
  activo: true,
  alcance: { id: 23, codigo: 'una_prueba', nombre: 'Una prueba' },
  periodicidad: { id: 31, codigo: 'mensual', nombre: 'Mensual' },
  productos: { google_play: 'una_prueba_mensual', app_store: 'una_prueba_mensual' },
};

export function edicionDe(plan: PlanAdministrable) {
  const { nombre, precioClp, productos, activo } = plan;
  return {
    nombre,
    precioClp,
    productos,
    activo,
    alcanceId: plan.alcance.id,
    periodicidadId: plan.periodicidad.id,
  };
}

// Solo se usa sobre la base temporal: restaura la oferta inicial entre los casos de CP-12.
export async function restaurarPlanes(bd: pg.Client, planes: PlanAdministrable[]) {
  await vaciarTablas(bd, ['contenido.plan']);
  for (const plan of planes) {
    await bd.query(
      `INSERT INTO contenido.plan
      (id, nombre, alcance_plan_id, periodicidad_id, precio_clp, activo) VALUES ($1,$2,$3,$4,$5,$6)`,
      [plan.id, plan.nombre, plan.alcance.id, plan.periodicidad.id, plan.precioClp, plan.activo],
    );
    await productosDelPlan(bd, plan);
  }
}

async function productosDelPlan(bd: Ejecutor, plan: PlanAdministrable) {
  for (const [tienda, producto] of Object.entries(plan.productos)) {
    await bd.query(
      `INSERT INTO contenido.plan_producto_tienda
      SELECT $1, id, $3 FROM contenido.canal_venta WHERE codigo = $2`,
      [plan.id, tienda, producto],
    );
  }
}
