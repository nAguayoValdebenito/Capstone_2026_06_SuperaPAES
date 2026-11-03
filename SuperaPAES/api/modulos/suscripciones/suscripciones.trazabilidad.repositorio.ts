// SQL de la trazabilidad de suscripciones en la consola (HU-56, CU-27, RF-C09, RN-17, RN-26): resumen,
// lista con filtros, línea de tiempo de cada suscripción con sus pagos y avisos, y avisos con error.
// Solo lee. Nunca entrega el token de compra (id_compra_tienda) ni el id del pago en la tienda, y el
// modelo no guarda datos de tarjetas. Lee el correo de app.estudiante (de cuentas) solo si la cuenta
// sigue activa: si el estudiante la eliminó, su historial aparece seudonimizado (correo null).
// «Del mes» es el mes en curso en Chile, igual que los filtros de fechas de la lista.
// Consultas siempre parametrizadas.
import type { QueryResultRow } from 'pg';
import { type Pagina, paginaConTotal } from '../../db/paginacion.js';
import type { Ejecutor } from '../../db/transaccion.js';
import type { FiltrosSuscripciones } from './suscripciones.trazabilidad.validadores.js';

/** Un valor de una lista de opciones (estado, tienda, origen, resultado). */
export interface OpcionDeLista {
  codigo: string;
  nombre: string;
}

export interface ResumenSuscripciones {
  activas: number;
  enMora: number;
  /** Creadas este mes que la tienda cobró: ni pendientes ni fallidas. */
  altasDelMes: number;
  /** Cambios a cancelada registrados este mes en el historial. */
  cancelacionesDelMes: number;
  ingresosDelMes: number;
  avisosConError: number;
  porPlanYEstado: { plan: string; estado: OpcionDeLista; suscripciones: number }[];
  /** Pagos de los últimos 12 meses con pagos, del más reciente al más antiguo. */
  meses: { mes: string; pagosAprobados: number; pagosRechazados: number; ingresosClp: number }[];
  /** Opciones de los filtros: todos los estados (RN-26) y todos los planes. */
  estados: OpcionDeLista[];
  planes: { id: number; nombre: string }[];
}

export interface FilaSuscripcion {
  id: string;
  /** null si el estudiante eliminó su cuenta. */
  correo: string | null;
  plan: string;
  tienda: OpcionDeLista;
  estado: OpcionDeLista;
  creadoEn: Date;
}

export interface DetalleSuscripcion extends FilaSuscripcion {
  historial: {
    id: string;
    fecha: Date;
    estadoAnterior: OpcionDeLista | null;
    estadoNuevo: OpcionDeLista;
    planAnterior: string | null;
    planNuevo: string;
    origen: OpcionDeLista;
    detalle: string | null;
  }[];
  pagos: {
    id: string;
    montoClp: number;
    estado: OpcionDeLista;
    periodoInicio: string;
    periodoFin: string;
    creadoEn: Date;
  }[];
  avisos: AvisoDeTienda[];
}

export interface AvisoDeTienda {
  id: string;
  tienda: OpcionDeLista;
  tipo: string;
  resultado: OpcionDeLista;
  /** Lo que hizo el sistema con el aviso; en uno con error, el motivo. */
  detalle: string | null;
  recibidoEn: Date;
}

export interface AvisoConError extends AvisoDeTienda {
  /** La suscripción del aviso (directa o por su pago); null si no se pudo asociar. */
  suscripcionId: string | null;
}

const opcion = (alias: string) =>
  `json_build_object('codigo', ${alias}.codigo, 'nombre', ${alias}.nombre)`;

// Una sola consulta: cada vista se calcula una vez (un CTE usado varias veces se materializa) y el
// resumen usa una sola conexión. hoy.mes es el primer instante del mes en curso en Chile.
const RESUMEN = `
  WITH hoy AS (SELECT date_trunc('month', now() AT TIME ZONE 'America/Santiago') AS mes),
       r AS (SELECT * FROM app.v_resumen_suscripciones),
       m AS (SELECT mes, SUM(pagos_aprobados)::int AS aprobados, SUM(pagos_rechazados)::int AS rechazados,
                    SUM(ingresos_clp)::int AS ingresos
               FROM app.v_pagos_mes GROUP BY mes),
       pe AS (SELECT r.plan_id, r.plan, r.estado, SUM(r.suscripciones)::int AS suscripciones
                FROM r GROUP BY r.plan_id, r.plan, r.estado)
  SELECT
    (SELECT COALESCE(SUM(suscripciones) FILTER (WHERE estado = 'activa'), 0)::int FROM r) AS activas,
    (SELECT COALESCE(SUM(suscripciones) FILTER (WHERE estado = 'en_mora'), 0)::int FROM r) AS "enMora",
    (SELECT count(*)::int FROM app.suscripcion s
       JOIN contenido.estado_suscripcion e ON e.id = s.estado_suscripcion_id, hoy
      WHERE e.codigo NOT IN ('pendiente', 'fallida')
        AND s.creado_en >= hoy.mes AT TIME ZONE 'America/Santiago') AS "altasDelMes",
    (SELECT count(*)::int FROM app.suscripcion_evento h
       JOIN contenido.estado_suscripcion e ON e.id = h.estado_nuevo_id, hoy
      WHERE e.codigo = 'cancelada' AND h.creado_en >= hoy.mes AT TIME ZONE 'America/Santiago')
      AS "cancelacionesDelMes",
    (SELECT COALESCE(SUM(ingresos), 0)::int FROM m, hoy WHERE m.mes = hoy.mes::date) AS "ingresosDelMes",
    (SELECT count(*)::int FROM app.evento_pasarela a
       JOIN contenido.resultado_evento re ON re.id = a.resultado_evento_id
      WHERE re.codigo = 'error') AS "avisosConError",
    (SELECT COALESCE(json_agg(json_build_object('plan', pe.plan, 'estado', ${opcion('e')},
                                                'suscripciones', pe.suscripciones)
                              ORDER BY pe.plan_id, e.id), '[]')
       FROM pe JOIN contenido.estado_suscripcion e ON e.codigo = pe.estado) AS "porPlanYEstado",
    (SELECT COALESCE(json_agg(json_build_object('mes', to_char(u.mes, 'YYYY-MM'), 'pagosAprobados', u.aprobados,
                                                'pagosRechazados', u.rechazados, 'ingresosClp', u.ingresos)
                              ORDER BY u.mes DESC), '[]')
       FROM (SELECT * FROM m ORDER BY mes DESC LIMIT 12) u) AS meses,
    (SELECT json_agg(${opcion('e')} ORDER BY e.id) FROM contenido.estado_suscripcion e) AS estados,
    (SELECT json_agg(json_build_object('id', p.id, 'nombre', p.nombre) ORDER BY p.id)
       FROM contenido.plan p) AS planes`;

const DE_LA_SUSCRIPCION = `
  FROM app.suscripcion s
  JOIN app.estudiante est ON est.id = s.estudiante_id
  JOIN contenido.plan pl ON pl.id = s.plan_id
  JOIN contenido.estado_suscripcion e ON e.id = s.estado_suscripcion_id
  JOIN contenido.canal_venta c ON c.id = s.canal_venta_id`;

const CAMPOS_FILA = `
  s.id::text AS id, CASE WHEN est.eliminado_en IS NULL THEN est.correo END AS correo,
  pl.nombre AS plan, ${opcion('c')} AS tienda, ${opcion('e')} AS estado, s.creado_en AS "creadoEn"`;

// El correo se busca solo en cuentas activas: el de una eliminada ya no es suyo (RN-17).
const FILTRADAS = `${DE_LA_SUSCRIPCION}
  WHERE ($1::text IS NULL OR e.codigo = $1)
    AND ($2::smallint IS NULL OR s.plan_id = $2)
    AND ($3::date IS NULL OR s.creado_en >= $3::date::timestamp AT TIME ZONE 'America/Santiago')
    AND ($4::date IS NULL OR s.creado_en < ($4::date + 1)::timestamp AT TIME ZONE 'America/Santiago')
    AND ($5::text IS NULL OR (est.eliminado_en IS NULL AND position(lower($5) IN lower(est.correo)) > 0))`;

const LISTAR = `
  SELECT ${CAMPOS_FILA}, count(*) OVER ()::int AS total
  ${FILTRADAS}
   ORDER BY s.creado_en DESC, s.id DESC
   LIMIT $6 OFFSET $7`;

const TOTAL = `SELECT count(*)::int AS total ${FILTRADAS}`;

const DETALLE = `SELECT ${CAMPOS_FILA} ${DE_LA_SUSCRIPCION} WHERE s.id = $1`;

const HISTORIAL = `
  SELECT h.id::text AS id, h.creado_en AS fecha,
         CASE WHEN ea.id IS NULL THEN NULL ELSE ${opcion('ea')} END AS "estadoAnterior",
         ${opcion('en')} AS "estadoNuevo", pa.nombre AS "planAnterior", pn.nombre AS "planNuevo",
         ${opcion('o')} AS origen, h.detalle
    FROM app.suscripcion_evento h
    LEFT JOIN contenido.estado_suscripcion ea ON ea.id = h.estado_anterior_id
    JOIN contenido.estado_suscripcion en ON en.id = h.estado_nuevo_id
    LEFT JOIN contenido.plan pa ON pa.id = h.plan_anterior_id
    JOIN contenido.plan pn ON pn.id = h.plan_nuevo_id
    JOIN contenido.origen_evento o ON o.id = h.origen_evento_id
   WHERE h.suscripcion_id = $1
   ORDER BY h.creado_en DESC, h.id DESC`;

const PAGOS = `
  SELECT p.id::text AS id, p.monto_clp AS "montoClp", ${opcion('ep')} AS estado,
         to_char(p.periodo_inicio, 'YYYY-MM-DD') AS "periodoInicio",
         to_char(p.periodo_fin, 'YYYY-MM-DD') AS "periodoFin", p.creado_en AS "creadoEn"
    FROM app.pago p
    JOIN contenido.estado_pago ep ON ep.id = p.estado_pago_id
   WHERE p.suscripcion_id = $1
   ORDER BY p.creado_en DESC, p.id DESC`;

const CAMPOS_AVISO = `
  a.id::text AS id, ${opcion('c')} AS tienda, a.tipo, ${opcion('re')} AS resultado, a.detalle,
  a.recibido_en AS "recibidoEn"`;

const DE_LOS_AVISOS = `
  FROM app.evento_pasarela a
  JOIN contenido.canal_venta c ON c.id = a.canal_venta_id
  JOIN contenido.resultado_evento re ON re.id = a.resultado_evento_id`;

// Un aviso es de la suscripción si apunta a ella o a uno de sus pagos.
const AVISOS = `
  SELECT ${CAMPOS_AVISO}
  ${DE_LOS_AVISOS}
   WHERE a.suscripcion_id = $1
      OR a.pago_id IN (SELECT id FROM app.pago WHERE suscripcion_id = $1)
   ORDER BY a.recibido_en DESC, a.id DESC`;

const CON_ERROR = `${DE_LOS_AVISOS}
  LEFT JOIN app.pago pg ON pg.id = a.pago_id
  WHERE re.codigo = 'error'`;

const AVISOS_CON_ERROR = `
  SELECT ${CAMPOS_AVISO}, COALESCE(a.suscripcion_id, pg.suscripcion_id)::text AS "suscripcionId",
         count(*) OVER ()::int AS total
  ${CON_ERROR}
   ORDER BY a.recibido_en DESC, a.id DESC
   LIMIT $1 OFFSET $2`;

const TOTAL_CON_ERROR = `SELECT count(*)::int AS total ${CON_ERROR}`;

/** El límite y el desplazamiento de una página. */
export type Tramo = [limite: number, desplazamiento: number];

export function crearTrazabilidadRepositorio(bd: Ejecutor) {
  const filas = async <T extends QueryResultRow>(consulta: string, parametros: unknown[] = []) =>
    (await bd.query<T>(consulta, parametros)).rows;
  return {
    async resumen(): Promise<ResumenSuscripciones> {
      const [resumen] = await filas<ResumenSuscripciones>(RESUMEN);
      if (!resumen) throw new Error('El resumen de suscripciones no devolvió filas.');
      return resumen;
    },

    listar(filtros: FiltrosSuscripciones, tramo: Tramo): Promise<Pagina<FilaSuscripcion>> {
      const { estado, plan, desde, hasta, correo } = filtros;
      const filtro = [estado, plan, desde, hasta, correo].map((valor) => valor ?? null);
      return paginaConTotal<FilaSuscripcion>(bd, [LISTAR, TOTAL], filtro, tramo);
    },

    async detalle(id: string): Promise<DetalleSuscripcion | null> {
      const [suscripcion] = await filas<FilaSuscripcion>(DETALLE, [id]);
      if (!suscripcion) return null;
      const [historial, pagos, avisos] = await Promise.all([
        filas<DetalleSuscripcion['historial'][number]>(HISTORIAL, [id]),
        filas<DetalleSuscripcion['pagos'][number]>(PAGOS, [id]),
        filas<AvisoDeTienda>(AVISOS, [id]),
      ]);
      return { ...suscripcion, historial, pagos, avisos };
    },

    avisosConError(tramo: Tramo): Promise<Pagina<AvisoConError>> {
      return paginaConTotal<AvisoConError>(bd, [AVISOS_CON_ERROR, TOTAL_CON_ERROR], [], tramo);
    },
  };
}

export type TrazabilidadRepositorio = ReturnType<typeof crearTrazabilidadRepositorio>;
