// SQL de las compras de suscripciones (HU-43.1): la suscripción pendiente, su plan en cada tienda, la
// prueba de «Una prueba» y el historial (app.suscripcion_evento, RN-17). Consultas parametrizadas; cada
// método recibe el Ejecutor de la transacción del servicio.
import type { EstadoSuscripcion, Tienda } from '../../adaptadores/pagos/pasarela.js';
import type { Ejecutor } from '../../db/transaccion.js';

/** Un plan activo con su producto en una tienda (contenido.plan_producto_tienda). */
export interface PlanEnTienda {
  planId: number;
  alcance: 'una_prueba' | 'todas';
  idProducto: string;
  precioClp: number;
}

/** Una suscripción con su plan, su tienda, su producto y su prueba elegida. */
export interface FilaSuscripcion {
  id: string;
  estudianteId: string;
  estado: EstadoSuscripcion;
  planId: number;
  tienda: Tienda;
  idProducto: string;
  idCompraTienda: string | null;
  periodoFin: Date | null;
  pruebaId: number | null;
}

/** Un registro del historial: el estado y el plan anteriores son los del último registro (RN-17). */
export interface CambioSuscripcion {
  suscripcionId: string;
  estadoAnterior: EstadoSuscripcion | null;
  estadoNuevo: EstadoSuscripcion;
  planAnterior: number | null;
  planNuevo: number;
  // HU-44 agrega pasarela (con su aviso) y sistema.
  origen: 'estudiante';
  ahora: Date;
}

const PLAN_EN_TIENDA = `
  SELECT pl.id AS "planId", a.codigo AS alcance, pt.id_producto AS "idProducto",
         pl.precio_clp AS "precioClp"
    FROM contenido.plan pl
    JOIN contenido.alcance_plan a ON a.id = pl.alcance_plan_id
    JOIN contenido.plan_producto_tienda pt ON pt.plan_id = pl.id
    JOIN contenido.canal_venta c ON c.id = pt.canal_venta_id
   WHERE pl.id = $1 AND c.codigo = $2 AND pl.activo`;

const SUSCRIPCION = `
  SELECT s.id::text AS id, s.estudiante_id::text AS "estudianteId", e.codigo AS estado,
         s.plan_id AS "planId", c.codigo AS tienda, pt.id_producto AS "idProducto",
         s.id_compra_tienda AS "idCompraTienda", s.periodo_fin AS "periodoFin",
         (SELECT MIN(sp.prueba_id) FROM app.suscripcion_prueba sp WHERE sp.suscripcion_id = s.id)
           AS "pruebaId"
    FROM app.suscripcion s
    JOIN contenido.estado_suscripcion e ON e.id = s.estado_suscripcion_id
    JOIN contenido.canal_venta c ON c.id = s.canal_venta_id
    JOIN contenido.plan_producto_tienda pt
      ON pt.plan_id = s.plan_id AND pt.canal_venta_id = s.canal_venta_id`;

// Un registro del historial: el trigger exige que el estado y el plan anteriores sean los del último.
const REGISTRAR_CAMBIO = `
  INSERT INTO app.suscripcion_evento
     (suscripcion_id, estado_anterior_id, estado_nuevo_id, plan_anterior_id, plan_nuevo_id,
      origen_evento_id, creado_en)
   SELECT $1, ea.id, en.id, $4, $5, o.id, $7
     FROM contenido.estado_suscripcion en
     JOIN contenido.origen_evento o ON o.codigo = $6
     LEFT JOIN contenido.estado_suscripcion ea ON ea.codigo = $2::text
    WHERE en.codigo = $3`;

/** Lecturas: el plan en la tienda, la prueba y la suscripción vigente. */
function lecturas(bd: Ejecutor) {
  return {
    async planEnTienda(planId: number, tienda: Tienda, tx: Ejecutor = bd) {
      const { rows } = await tx.query<PlanEnTienda>(PLAN_EN_TIENDA, [planId, tienda]);
      return rows[0] ?? null;
    },

    async pruebaExiste(pruebaId: number, tx: Ejecutor = bd): Promise<boolean> {
      const { rows } = await tx.query('SELECT 1 FROM contenido.prueba WHERE id = $1', [pruebaId]);
      return rows.length > 0;
    },

    /** La suscripción vigente del estudiante (pendiente, activa o en mora), bloqueada. */
    async vigenteBloqueada(estudianteId: string, tx: Ejecutor = bd) {
      const { rows } = await tx.query<FilaSuscripcion>(
        `${SUSCRIPCION} WHERE s.estudiante_id = $1 AND s.vigente FOR UPDATE OF s`,
        [estudianteId],
      );
      return rows[0] ?? null;
    },
  };
}

/** Escrituras: la pendiente, su plan, su prueba y el historial. */
function escrituras(bd: Ejecutor) {
  return {
    /** La pendiente nueva; la vigencia la pone la base. Devuelve su id. */
    async insertarPendiente(
      datos: { estudianteId: string; planId: number; tienda: Tienda; ahora: Date },
      tx: Ejecutor = bd,
    ): Promise<string> {
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO app.suscripcion
           (estudiante_id, plan_id, estado_suscripcion_id, vigente, canal_venta_id, creado_en)
         SELECT $1, $2, e.id, e.vigente, c.id, $4
           FROM contenido.estado_suscripcion e, contenido.canal_venta c
          WHERE e.codigo = 'pendiente' AND c.codigo = $3
         RETURNING id::text AS id`,
        [datos.estudianteId, datos.planId, datos.tienda, datos.ahora],
      );
      const id = rows[0]?.id;
      if (!id) throw new Error('El INSERT de la suscripción no devolvió el id.');
      return id;
    },

    async cambiarPlanPendiente(id: string, planId: number, tienda: Tienda, tx: Ejecutor = bd) {
      await tx.query(
        `UPDATE app.suscripcion
            SET plan_id = $2,
                canal_venta_id = (SELECT id FROM contenido.canal_venta WHERE codigo = $3)
          WHERE id = $1`,
        [id, planId, tienda],
      );
    },

    /** Deja como única prueba elegida la indicada, o ninguna. */
    async fijarPrueba(id: string, pruebaId: number | null, tx: Ejecutor = bd) {
      await tx.query('DELETE FROM app.suscripcion_prueba WHERE suscripcion_id = $1', [id]);
      if (pruebaId !== null) {
        await tx.query(
          'INSERT INTO app.suscripcion_prueba (suscripcion_id, prueba_id) VALUES ($1, $2)',
          [id, pruebaId],
        );
      }
    },

    async registrarCambio(cambio: CambioSuscripcion, tx: Ejecutor = bd) {
      await tx.query(REGISTRAR_CAMBIO, [
        cambio.suscripcionId,
        cambio.estadoAnterior,
        cambio.estadoNuevo,
        cambio.planAnterior,
        cambio.planNuevo,
        cambio.origen,
        cambio.ahora,
      ]);
    },
  };
}

export function crearComprasRepositorio(bd: Ejecutor) {
  return { ...lecturas(bd), ...escrituras(bd) };
}

export type ComprasRepositorio = ReturnType<typeof crearComprasRepositorio>;
