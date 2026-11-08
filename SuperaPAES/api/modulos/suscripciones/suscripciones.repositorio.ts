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
import { MARGEN_FIN_PERIODO } from './suscripciones.cierre.repositorio.js';

/** La suscripción activa o en mora de un estudiante (RN-34): la tienda la sigue cobrando. */
export interface SuscripcionVigente {
  estado: 'activa' | 'en_mora';
  /** Nombre del alcance: «Una prueba» o «Todas las pruebas». */
  plan: string;
  periodicidad: 'mensual' | 'anual';
  tienda: Tienda;
  /** Fin del período pagado: la próxima renovación, o el término si canceló. */
  periodoFin: Date | null;
  /** `false` si el estudiante canceló la renovación en la tienda (CU-12 1.a). */
  renuevaAutomaticamente: boolean;
  /** Dónde se gestiona y se cancela en la tienda (HU-45.2). */
  gestionUrl: string;
  /** Cobertura para la app (F3), calculada con las mismas reglas de RN-04 y A-03. */
  alcance?: 'una_prueba' | 'todas';
  pruebasIncluidas?: number[];
  coberturaVigente?: boolean;
}

/** La vigente como sale de la base: la dirección de la tienda se arma con su producto. */
export type FilaVigente = Omit<SuscripcionVigente, 'gestionUrl'> & { idProducto: string | null };

interface Opcion {
  codigo: string;
  nombre: string;
}

/** Un plan que se ofrece (A43): su precio y su producto en cada tienda (CU-12 paso 1). */
export interface PlanOfrecido {
  id: number;
  nombre: string;
  alcance: Opcion;
  periodicidad: Opcion & { meses: number };
  precioClp: number;
  /** Pruebas que cubre; `null` en Todas las pruebas. */
  pruebasCubiertas: number | null;
  /** Producto de cada tienda, por código de tienda. */
  productos: Record<string, string>;
}

// Primero Una prueba y luego Todas las pruebas, y en cada uno el mensual antes que el anual.
const PLANES = `
  SELECT pl.id, pl.nombre, pl.precio_clp AS "precioClp", a.pruebas_cubiertas AS "pruebasCubiertas",
         jsonb_build_object('codigo', a.codigo, 'nombre', a.nombre) AS alcance,
         jsonb_build_object('codigo', p.codigo, 'nombre', p.nombre, 'meses', p.meses) AS periodicidad,
         COALESCE((SELECT jsonb_object_agg(c.codigo, pt.id_producto)
                     FROM contenido.plan_producto_tienda pt
                     JOIN contenido.canal_venta c ON c.id = pt.canal_venta_id
                    WHERE pt.plan_id = pl.id), '{}'::jsonb) AS productos
    FROM contenido.plan pl
    JOIN contenido.alcance_plan a ON a.id = pl.alcance_plan_id
    JOIN contenido.periodicidad p ON p.id = pl.periodicidad_id
   WHERE pl.activo
   ORDER BY a.id, p.meses`;

// La fecha se recibe del reloj del servicio; la app no decide la vigencia.
const AL_DIA = (ahora: string) =>
  `(e.codigo = 'en_mora' OR s.periodo_fin IS NULL
    OR s.periodo_fin >= ${ahora}::timestamptz - ${MARGEN_FIN_PERIODO})`;

// Solo activa o en mora: una pendiente todavía no se cobra (RN-34). El índice ux_suscripcion_vigente
// deja una sola vigente por estudiante. No mira el fin del período: dice si la tienda puede seguir
// cobrando, aunque el aviso que cerraría la suscripción no haya llegado.
const VIGENTE = `
  SELECT e.codigo AS estado, a.nombre AS plan, p.codigo AS periodicidad, c.codigo AS tienda,
         s.periodo_fin AS "periodoFin", s.cancelada_en IS NULL AS "renuevaAutomaticamente",
         pt.id_producto AS "idProducto", a.codigo AS alcance,
         ${AL_DIA('$2')} AS "coberturaVigente",
         COALESCE((SELECT array_agg(sp.prueba_id ORDER BY sp.prueba_id)
                     FROM app.suscripcion_prueba sp WHERE sp.suscripcion_id = s.id),
                  ARRAY[]::smallint[]) AS "pruebasIncluidas"
    FROM app.suscripcion s
    JOIN contenido.estado_suscripcion e ON e.id = s.estado_suscripcion_id
    JOIN contenido.plan pl ON pl.id = s.plan_id
    JOIN contenido.alcance_plan a ON a.id = pl.alcance_plan_id
    JOIN contenido.periodicidad p ON p.id = pl.periodicidad_id
    JOIN contenido.canal_venta c ON c.id = s.canal_venta_id
    LEFT JOIN contenido.plan_producto_tienda pt
      ON pt.plan_id = s.plan_id AND pt.canal_venta_id = s.canal_venta_id
   WHERE s.estudiante_id = $1 AND e.codigo IN ('activa', 'en_mora')`;

// A-03: una activa da acceso hasta el fin del período pagado, más el margen para esperar el aviso de la
// tienda; si no llega, deja de dar acceso aunque siga activa. En mora no se mira: el período ya terminó y
// la tienda reintenta el cobro (RN-26). `ahora` es el número del parámetro con el reloj de la API.

// RN-04: solo activa o en mora dan acceso (RN-26). Todas las pruebas cubre cualquier prueba; Una prueba,
// la elegida en app.suscripcion_prueba.
const CUBRE_PRUEBA = `
  SELECT EXISTS (
    SELECT 1
      FROM app.suscripcion s
      JOIN contenido.estado_suscripcion e ON e.id = s.estado_suscripcion_id
      JOIN contenido.plan pl ON pl.id = s.plan_id
      JOIN contenido.alcance_plan a ON a.id = pl.alcance_plan_id
     WHERE s.estudiante_id = $1 AND e.codigo IN ('activa', 'en_mora')
       AND ${AL_DIA('$3')}
       AND (a.codigo = 'todas'
            OR EXISTS (SELECT 1 FROM app.suscripcion_prueba sp
                        WHERE sp.suscripcion_id = s.id AND sp.prueba_id = $2))
  ) AS cubre`;

export function crearSuscripcionesRepositorio(bd: Ejecutor) {
  return {
    async planesOfrecidos(): Promise<PlanOfrecido[]> {
      const { rows } = await bd.query<PlanOfrecido>(PLANES);
      return rows;
    },

    async vigenteDe(
      estudianteId: string,
      ahora: Date,
      tx: Ejecutor = bd,
    ): Promise<FilaVigente | null> {
      const { rows } = await tx.query<FilaVigente>(VIGENTE, [estudianteId, ahora]);
      return rows[0] ?? null;
    },

    async cubrePrueba(
      estudianteId: string,
      pruebaId: number,
      ahora: Date,
      tx: Ejecutor = bd,
    ): Promise<boolean> {
      const { rows } = await tx.query<{ cubre: boolean }>(CUBRE_PRUEBA, [
        estudianteId,
        pruebaId,
        ahora,
      ]);
      return rows[0]?.cubre ?? false;
    },
    async permiteEnsayoCompleto(
      estudianteId: string,
      ahora: Date,
      tx: Ejecutor = bd,
    ): Promise<boolean> {
      const { rows } = await tx.query<{ permite: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM app.suscripcion s
          JOIN contenido.estado_suscripcion e ON e.id=s.estado_suscripcion_id
          JOIN contenido.plan p ON p.id=s.plan_id
          JOIN contenido.alcance_plan a ON a.id=p.alcance_plan_id
          WHERE s.estudiante_id=$1 AND e.codigo IN ('activa','en_mora') AND a.codigo='todas'
            AND ${AL_DIA('$2')}) AS permite`,
        [estudianteId, ahora],
      );
      return rows[0]?.permite ?? false;
    },
  };
}

export type SuscripcionesRepositorio = ReturnType<typeof crearSuscripcionesRepositorio>;
