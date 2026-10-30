// Único lugar con SQL del módulo suscripciones. Consultas siempre parametrizadas ($1, $2...).
// Tablas que pertenecen a este módulo (ningún otro módulo las escribe):
//   - contenido.plan
//   - contenido.plan_producto_tienda
//   - app.suscripcion
//   - app.suscripcion_prueba
//   - app.pago
//   - app.suscripcion_evento (historial con estado y plan anterior y nuevo, sin saltos: RN-17)
//   - app.evento_pasarela
//   - vista app.v_resumen_suscripciones
//   - vista app.v_pagos_mes
// Cada método recibe un Ejecutor opcional (tx) para sumarse a la transacción del servicio.
import type { Tienda } from '../../adaptadores/pagos/pasarela.js';
import type { Ejecutor } from '../../db/transaccion.js';

/** La suscripción activa o en mora de un estudiante (RN-34): la tienda la sigue cobrando. */
export interface SuscripcionVigente {
  estado: 'activa' | 'en_mora';
  /** Nombre del alcance: «Una prueba» o «Todas las pruebas». */
  plan: string;
  periodicidad: 'mensual' | 'anual';
  tienda: Tienda;
}

// Solo activa o en mora: una pendiente todavía no se cobra (RN-34). El índice ux_suscripcion_vigente
// deja una sola vigente por estudiante.
const VIGENTE = `
  SELECT e.codigo AS estado, a.nombre AS plan, p.codigo AS periodicidad, c.codigo AS tienda
    FROM app.suscripcion s
    JOIN contenido.estado_suscripcion e ON e.id = s.estado_suscripcion_id
    JOIN contenido.plan pl ON pl.id = s.plan_id
    JOIN contenido.alcance_plan a ON a.id = pl.alcance_plan_id
    JOIN contenido.periodicidad p ON p.id = pl.periodicidad_id
    JOIN contenido.canal_venta c ON c.id = s.canal_venta_id
   WHERE s.estudiante_id = $1 AND e.codigo IN ('activa', 'en_mora')`;

export function crearSuscripcionesRepositorio(bd: Ejecutor) {
  return {
    async vigenteDe(estudianteId: string, tx: Ejecutor = bd): Promise<SuscripcionVigente | null> {
      const { rows } = await tx.query<SuscripcionVigente>(VIGENTE, [estudianteId]);
      return rows[0] ?? null;
    },
  };
}

export type SuscripcionesRepositorio = ReturnType<typeof crearSuscripcionesRepositorio>;
