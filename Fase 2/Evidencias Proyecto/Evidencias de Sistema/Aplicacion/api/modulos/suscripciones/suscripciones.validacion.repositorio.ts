// SQL de la validación de compras (HU-43.1): la suscripción del estudiante (bloqueada dentro de la
// transacción), el plan de un producto de la tienda, la compra ligada a otra suscripción, la suscripción
// actualizada y el pago, que se registra una sola vez por cobro (ON CONFLICT DO NOTHING). Consultas
// parametrizadas; cada método recibe el Ejecutor de la transacción del servicio.
import type { EstadoSuscripcion, Tienda } from '../../adaptadores/pagos/pasarela.js';
import type { Ejecutor } from '../../db/transaccion.js';
import {
  leerBloqueada,
  SUSCRIPCION,
  type FilaSuscripcion,
  type PlanEnTienda,
} from './suscripciones.compras.repositorio.js';

/** Un plan con su producto en la tienda y los meses de su período. */
export interface PlanDeProducto extends PlanEnTienda {
  meses: number;
}

export interface CompraAplicada {
  suscripcionId: string;
  estado: EstadoSuscripcion;
  planId: number;
  idCompraTienda: string;
  periodoFin: Date | null;
  ahora: Date;
}

export interface PagoDeCompra {
  suscripcionId: string;
  idPagoPasarela: string;
  /** Valor de referencia: el precio del plan, no lo que cobró la tienda. */
  montoClp: number;
  /** Si la tienda no informa el inicio, es el fin menos los meses del plan. */
  periodoInicio: Date | null;
  periodoFin: Date;
  meses: number;
  ahora: Date;
}

const PLAN_DE_PRODUCTO = `
  SELECT pl.id AS "planId", a.codigo AS alcance, pt.id_producto AS "idProducto",
         pl.precio_clp AS "precioClp", p.meses
    FROM contenido.plan_producto_tienda pt
    JOIN contenido.canal_venta c ON c.id = pt.canal_venta_id
    JOIN contenido.plan pl ON pl.id = pt.plan_id
    JOIN contenido.alcance_plan a ON a.id = pl.alcance_plan_id
    JOIN contenido.periodicidad p ON p.id = pl.periodicidad_id
   WHERE c.codigo = $1 AND pt.id_producto = $2`;

// La suscripción activa queda con su compra, su plan y el fin del período; el inicio es el de la
// primera activación. La vigencia la recalcula la base al cambiar el estado.
const APLICAR_COMPRA = `
  UPDATE app.suscripcion
     SET estado_suscripcion_id = (SELECT id FROM contenido.estado_suscripcion WHERE codigo = $2::text),
         plan_id = $3,
         id_compra_tienda = $4,
         periodo_fin = $5,
         inicio = CASE WHEN $2::text = 'activa' THEN COALESCE(inicio, $6) ELSE inicio END
   WHERE id = $1`;

// Las fechas del período son las de Chile (RN-02).
const REGISTRAR_PAGO = `
  INSERT INTO app.pago
    (suscripcion_id, id_pago_pasarela, monto_clp, estado_pago_id, periodo_inicio, periodo_fin, creado_en)
  SELECT $1, $2, $3, e.id,
         (COALESCE($4::timestamptz, $5::timestamptz - make_interval(months => $6::int))
           AT TIME ZONE 'America/Santiago')::date,
         ($5::timestamptz AT TIME ZONE 'America/Santiago')::date,
         $7
    FROM contenido.estado_pago e
   WHERE e.codigo = 'aprobado'
  ON CONFLICT (id_pago_pasarela) DO NOTHING`;

/** Lecturas: la suscripción, el plan de un producto y la compra ligada a otra suscripción. */
function lecturas(bd: Ejecutor) {
  return {
    /** La suscripción si es del estudiante; dentro de la transacción, bloqueada. */
    async suscripcionDe(
      estudianteId: string,
      id: string,
      tx: Ejecutor = bd,
      bloquear = false,
    ): Promise<FilaSuscripcion | null> {
      if (bloquear)
        return leerBloqueada(tx, 's.id = $1 AND s.estudiante_id = $2', [id, estudianteId]);
      const { rows } = await tx.query<FilaSuscripcion>(
        `${SUSCRIPCION} WHERE s.id = $1 AND s.estudiante_id = $2`,
        [id, estudianteId],
      );
      return rows[0] ?? null;
    },

    async planDeProducto(tienda: Tienda, idProducto: string, tx: Ejecutor = bd) {
      const { rows } = await tx.query<PlanDeProducto>(PLAN_DE_PRODUCTO, [tienda, idProducto]);
      return rows[0] ?? null;
    },

    async compraEnOtraSuscripcion(
      idCompraTienda: string,
      suscripcionId: string,
      tx: Ejecutor = bd,
    ): Promise<boolean> {
      const { rows } = await tx.query(
        'SELECT 1 FROM app.suscripcion WHERE id_compra_tienda = $1 AND id <> $2',
        [idCompraTienda, suscripcionId],
      );
      return rows.length > 0;
    },
  };
}

/** Escrituras: la suscripción con su compra y el pago. */
function escrituras(bd: Ejecutor) {
  return {
    async aplicarCompra(compra: CompraAplicada, tx: Ejecutor = bd) {
      await tx.query(APLICAR_COMPRA, [
        compra.suscripcionId,
        compra.estado,
        compra.planId,
        compra.idCompraTienda,
        compra.periodoFin,
        compra.ahora,
      ]);
    },

    async registrarPago(pago: PagoDeCompra, tx: Ejecutor = bd) {
      await tx.query(REGISTRAR_PAGO, [
        pago.suscripcionId,
        pago.idPagoPasarela,
        pago.montoClp,
        pago.periodoInicio,
        pago.periodoFin,
        pago.meses,
        pago.ahora,
      ]);
    },
  };
}

export function crearValidacionRepositorio(bd: Ejecutor) {
  return { ...lecturas(bd), ...escrituras(bd) };
}

export type ValidacionRepositorio = ReturnType<typeof crearValidacionRepositorio>;
