// SQL del aviso de renovación anual (HU-45.3, CU-12 4.c, RN-05): las suscripciones anuales activas que siguen
// renovando y cuyo período termina dentro de 7 días. El monto es el precio del plan actual: el sistema no
// guarda cambios programados (RN-05). Una cuenta borrada se descarta al pedir sus datos a cuentas. Consultas
// parametrizadas.
import type { Tienda } from '../../adaptadores/pagos/pasarela.js';
import type { Ejecutor } from '../../db/transaccion.js';

/** Una renovación anual próxima, con lo que necesita su correo. */
export interface RenovacionPorAvisar {
  id: string;
  estudianteId: string;
  /** Nombre del plan, por ejemplo «Todas las pruebas anual». */
  plan: string;
  montoClp: number;
  tienda: Tienda;
  idProducto: string | null;
  periodoFin: Date;
}

const POR_AVISAR = `
  SELECT s.id::text AS id, s.estudiante_id::text AS "estudianteId", pl.nombre AS plan,
         pl.precio_clp AS "montoClp", c.codigo AS tienda, pt.id_producto AS "idProducto",
         s.periodo_fin AS "periodoFin"
    FROM app.suscripcion s
    JOIN contenido.estado_suscripcion e ON e.id = s.estado_suscripcion_id
    JOIN contenido.plan pl ON pl.id = s.plan_id
    JOIN contenido.periodicidad p ON p.id = pl.periodicidad_id
    JOIN contenido.canal_venta c ON c.id = s.canal_venta_id
    LEFT JOIN contenido.plan_producto_tienda pt
      ON pt.plan_id = s.plan_id AND pt.canal_venta_id = s.canal_venta_id
   WHERE e.codigo = 'activa' AND p.codigo = 'anual' AND s.cancelada_en IS NULL
     AND s.periodo_fin > $1::timestamptz
     AND s.periodo_fin <= $1::timestamptz + INTERVAL '7 days'
   ORDER BY s.periodo_fin, s.id`;

export function crearRenovacionRepositorio(bd: Ejecutor) {
  return {
    async porAvisar(ahora: Date): Promise<RenovacionPorAvisar[]> {
      const { rows } = await bd.query<RenovacionPorAvisar>(POR_AVISAR, [ahora]);
      return rows;
    },
  };
}

export type RenovacionRepositorio = ReturnType<typeof crearRenovacionRepositorio>;
