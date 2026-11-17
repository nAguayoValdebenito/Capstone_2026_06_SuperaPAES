// SQL de la suscripción simulada del modo de pruebas (MODO_PRUEBAS_SUSCRIPCION): el plan activo, la vigente
// del estudiante y la suscripción activa en el canal «prueba», sin compra en la tienda ni pago. El historial y
// la prueba de «Una prueba» se escriben con el repositorio de compras. Consultas parametrizadas; cada método
// recibe el Ejecutor de la transacción del servicio.
import type { Ejecutor } from '../../db/transaccion.js';
import { CANAL_PRUEBA } from './suscripciones.canal-prueba.js';

/** Un plan activo y su alcance (RN-05). */
export interface PlanActivo {
  planId: number;
  alcance: 'una_prueba' | 'todas';
}

export interface NuevaSimulada {
  estudianteId: string;
  planId: number;
  ahora: Date;
  periodoFin: Date;
}

// La vigencia la pone el estado (activa da acceso); el índice ux_suscripcion_vigente deja una sola vigente.
const INSERTAR_ACTIVA = `
  INSERT INTO app.suscripcion
     (estudiante_id, plan_id, estado_suscripcion_id, vigente, canal_venta_id, inicio, periodo_fin, creado_en)
  SELECT $1, $2, e.id, e.vigente, c.id, $3, $4, $3
    FROM contenido.estado_suscripcion e, contenido.canal_venta c
   WHERE e.codigo = 'activa' AND c.codigo = $5
  RETURNING id::text AS id`;

export function crearSimuladaRepositorio(bd: Ejecutor) {
  return {
    async planActivo(planId: number, tx: Ejecutor = bd): Promise<PlanActivo | null> {
      const { rows } = await tx.query<PlanActivo>(
        `SELECT pl.id AS "planId", a.codigo AS alcance
           FROM contenido.plan pl
           JOIN contenido.alcance_plan a ON a.id = pl.alcance_plan_id
          WHERE pl.id = $1 AND pl.activo`,
        [planId],
      );
      return rows[0] ?? null;
    },

    /** ¿Tiene una vigente (pendiente, activa o en mora), de cualquier canal? La bloquea. */
    async tieneVigente(estudianteId: string, tx: Ejecutor = bd): Promise<boolean> {
      const { rows } = await tx.query(
        'SELECT 1 FROM app.suscripcion WHERE estudiante_id = $1 AND vigente FOR UPDATE',
        [estudianteId],
      );
      return rows.length > 0;
    },

    /** La activa del canal «prueba». Devuelve su id. */
    async insertarActiva(datos: NuevaSimulada, tx: Ejecutor = bd): Promise<string> {
      const { rows } = await tx.query<{ id: string }>(INSERTAR_ACTIVA, [
        datos.estudianteId,
        datos.planId,
        datos.ahora,
        datos.periodoFin,
        CANAL_PRUEBA,
      ]);
      const id = rows[0]?.id;
      if (!id) throw new Error('El canal de prueba no existe: falta la migración 012.');
      return id;
    },
  };
}

export type SimuladaRepositorio = ReturnType<typeof crearSimuladaRepositorio>;
