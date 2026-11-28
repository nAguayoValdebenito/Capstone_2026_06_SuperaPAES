import type { Ejecutor } from '../../db/transaccion.js';
import type { ConsultaSaldo, NuevaTarifa } from './revision.saldo.validadores.js';

export interface TarifaRevision {
  id: string;
  montoClp: number;
  vigenteDesde: Date;
  creadoEn: Date;
}
export interface SaldoDocente {
  docente: { id: string; nombre: string };
  resumen: { totalClp: number; mesClp: number; cantidad: number; cantidadMes: number };
  capacidad: { pendientes: number; completadas: number; maxPendientes: number; maxDiarias: number };
  detalle: {
    revisionId: string;
    preguntaId: string;
    fecha: string;
    tipo: 'revision' | 'desempate';
    montoClp: number;
  }[];
  paginacion: { pagina: number; porPagina: number; total: number };
}
export interface SaldoRepositorio {
  reservarTarifas(tx: Ejecutor): Promise<void>;
  consultar(docenteId: string, consulta: ConsultaSaldo, ahora: Date): Promise<SaldoDocente | null>;
  listarTarifas(tx?: Ejecutor): Promise<TarifaRevision[]>;
  registrarTarifa(
    this: void,
    autorId: string,
    datos: NuevaTarifa,
    tx: Ejecutor,
  ): Promise<TarifaRevision>;
  docentes(): Promise<{ id: string; nombre: string }[]>;
}

const SALDO = `
 WITH movimientos AS (
   SELECT m.revision_id::text AS "revisionId", a.pregunta_id::text AS "preguntaId",
          m.fecha, CASE WHEN rr.codigo = 'desempate' THEN 'desempate' ELSE 'revision' END AS tipo,
          m.monto_clp AS "montoClp"
     FROM contenido.remuneracion_revision m
     JOIN contenido.revision r ON r.id = m.revision_id
     JOIN contenido.asignacion_revision a ON a.id = r.asignacion_id
     JOIN contenido.rol_revision rr ON rr.id = a.rol_revision_id
    WHERE a.docente_id = $1
 ), filtrados AS (
   SELECT * FROM movimientos
    WHERE ($2::date IS NULL OR fecha >= ($2::date::timestamp AT TIME ZONE 'America/Santiago'))
      AND ($3::date IS NULL OR fecha < (($3::date + 1)::timestamp AT TIME ZONE 'America/Santiago'))
 ), pagina AS (
   SELECT * FROM filtrados ORDER BY fecha DESC, "revisionId"::bigint DESC LIMIT $5 OFFSET $6
 )
 SELECT json_build_object('id', u.id::text, 'nombre', u.nombre) AS docente,
   (SELECT json_build_object('totalClp', COALESCE(sum("montoClp"), 0), 'cantidad', count(*),
     'mesClp', COALESCE(sum("montoClp") FILTER (WHERE date_trunc('month', fecha AT TIME ZONE 'America/Santiago') =
                 date_trunc('month', $4::timestamptz AT TIME ZONE 'America/Santiago')), 0),
     'cantidadMes', count(*) FILTER (WHERE date_trunc('month', fecha AT TIME ZONE 'America/Santiago') =
                 date_trunc('month', $4::timestamptz AT TIME ZONE 'America/Santiago'))) FROM movimientos) AS resumen,
   (SELECT json_build_object('pendientes', c.pendientes, 'completadas', c.completadas,
                             'maxPendientes', c.max_pendientes, 'maxDiarias', c.max_diarias)
      FROM contenido.capacidad_docente(u.id, $4::timestamptz) c) AS capacidad,
   COALESCE((SELECT json_agg(pagina ORDER BY fecha DESC, "revisionId"::bigint DESC) FROM pagina), '[]') AS detalle,
   (SELECT count(*)::int FROM filtrados) AS total
 FROM contenido.usuario_interno u JOIN contenido.rol rol ON rol.id = u.rol_id AND rol.codigo = 'docente'
 WHERE u.id = $1`;

const TARIFAS = `SELECT id::text, monto_clp AS "montoClp", vigente_desde AS "vigenteDesde",
                       creado_en AS "creadoEn" FROM contenido.tarifa_revision ORDER BY id DESC`;

export function crearSaldoRepositorio(bd: Ejecutor): SaldoRepositorio {
  return {
    async reservarTarifas(tx) {
      await tx.query('SELECT pg_advisory_xact_lock(6971)');
    },
    async consultar(docenteId, consulta, ahora) {
      const { rows } = await bd.query<Omit<SaldoDocente, 'paginacion'> & { total: number }>(SALDO, [
        docenteId,
        consulta.desde ?? null,
        consulta.hasta ?? null,
        ahora,
        consulta.porPagina,
        (consulta.pagina - 1) * consulta.porPagina,
      ]);
      const fila = rows[0];
      if (!fila) return null;
      const { total, ...saldo } = fila;
      return {
        ...saldo,
        paginacion: { pagina: consulta.pagina, porPagina: consulta.porPagina, total },
      };
    },
    async listarTarifas(tx = bd) {
      return (await tx.query<TarifaRevision>(TARIFAS)).rows;
    },
    async registrarTarifa(autorId, datos, tx) {
      const { rows } = await tx.query<TarifaRevision>(
        `
        INSERT INTO contenido.tarifa_revision(monto_clp, vigente_desde, creado_por)
        VALUES ($1, COALESCE($2::timestamptz, clock_timestamp()), $3)
        RETURNING id::text, monto_clp AS "montoClp", vigente_desde AS "vigenteDesde", creado_en AS "creadoEn"`,
        [datos.montoClp, datos.vigenteDesde ?? null, autorId],
      );
      const tarifa = rows[0];
      if (!tarifa) throw new Error('La tarifa no se guardó.');
      return tarifa;
    },
    async docentes() {
      return (
        await bd.query<{ id: string; nombre: string }>(`
        SELECT u.id::text, u.nombre FROM contenido.usuario_interno u
          JOIN contenido.rol r ON r.id = u.rol_id AND r.codigo = 'docente' ORDER BY u.nombre, u.id`)
      ).rows;
    },
  };
}
