// HU-52.1: lectura y escritura de plan y plan_producto_tienda, sin modificar las listas de opciones.
import type { Ejecutor } from '../../db/transaccion.js';
import type { DatosEditarPlan } from './suscripciones.planes.validadores.js';

interface OpcionPlan {
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

export interface OpcionesPlanes {
  alcances: OpcionPlan[];
  periodicidades: OpcionPlan[];
}

export interface PlanesRepositorio {
  listar(): Promise<PlanAdministrable[]>;
  opciones(tx?: Ejecutor): Promise<OpcionesPlanes>;
  obtener(id: number, tx: Ejecutor, bloquear?: boolean): Promise<PlanAdministrable | null>;
  editar(id: number, datos: DatosEditarPlan, tx: Ejecutor): Promise<void>;
}

const SELECCION = `SELECT pl.id, pl.nombre, pl.precio_clp AS "precioClp", pl.activo,
  jsonb_build_object('id', a.id, 'codigo', a.codigo, 'nombre', a.nombre) AS alcance,
  jsonb_build_object('id', p.id, 'codigo', p.codigo, 'nombre', p.nombre) AS periodicidad,
  jsonb_build_object(
    'google_play', COALESCE((SELECT pt.id_producto FROM contenido.plan_producto_tienda pt
      JOIN contenido.canal_venta c ON c.id = pt.canal_venta_id
      WHERE pt.plan_id = pl.id AND c.codigo = 'google_play'), ''),
    'app_store', COALESCE((SELECT pt.id_producto FROM contenido.plan_producto_tienda pt
      JOIN contenido.canal_venta c ON c.id = pt.canal_venta_id
      WHERE pt.plan_id = pl.id AND c.codigo = 'app_store'), '')) AS productos
  FROM contenido.plan pl
  JOIN contenido.alcance_plan a ON a.id = pl.alcance_plan_id
  JOIN contenido.periodicidad p ON p.id = pl.periodicidad_id`;

async function editar(id: number, datos: DatosEditarPlan, tx: Ejecutor): Promise<void> {
  const { nombre, alcanceId, periodicidadId, precioClp, activo, productos } = datos;
  await tx.query(
    `UPDATE contenido.plan SET nombre = $2, alcance_plan_id = $3, periodicidad_id = $4,
       precio_clp = $5, activo = $6 WHERE id = $1`,
    [id, nombre, alcanceId, periodicidadId, precioClp, activo],
  );
  for (const [tienda, producto] of Object.entries(productos)) {
    await tx.query(
      `INSERT INTO contenido.plan_producto_tienda (plan_id, canal_venta_id, id_producto)
       SELECT $1, id, $3 FROM contenido.canal_venta WHERE codigo = $2
       ON CONFLICT (plan_id, canal_venta_id) DO UPDATE SET id_producto = EXCLUDED.id_producto`,
      [id, tienda, producto],
    );
  }
}

export function crearPlanesRepositorio(bd: Ejecutor): PlanesRepositorio {
  return {
    listar: async () =>
      (await bd.query<PlanAdministrable>(`${SELECCION} ORDER BY a.id, p.meses`)).rows,
    async obtener(id, tx, bloquear = false) {
      if (bloquear) await tx.query('SELECT id FROM contenido.plan WHERE id = $1 FOR UPDATE', [id]);
      const { rows } = await tx.query<PlanAdministrable>(`${SELECCION} WHERE pl.id = $1`, [id]);
      return rows[0] ?? null;
    },
    async opciones(tx = bd) {
      const alcances = await tx.query<OpcionPlan>(
        'SELECT id, codigo, nombre FROM contenido.alcance_plan ORDER BY id',
      );
      const periodicidades = await tx.query<OpcionPlan>(
        `SELECT id, codigo, nombre FROM contenido.periodicidad
         WHERE codigo IN ('mensual', 'anual') ORDER BY meses`,
      );
      return { alcances: alcances.rows, periodicidades: periodicidades.rows };
    },
    editar,
  };
}
