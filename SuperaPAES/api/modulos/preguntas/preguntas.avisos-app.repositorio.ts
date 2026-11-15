// SQL de los avisos de error que envía el estudiante desde la app (HU-37, RF-A16, CU-13, A23). Guarda
// el aviso en app.reporte_pregunta, que es de este módulo, con la versión de la pregunta que vio el
// estudiante. Motivos y estados se leen por su código (listas de opciones). Consultas parametrizadas.
import type { Ejecutor } from '../../db/transaccion.js';
import type { Opcion } from './preguntas.repositorio.js';

/** Lo que se guarda: la pregunta y la versión las entrega evaluaciones desde el ítem. */
export interface AvisoNuevo {
  estudianteId: string;
  preguntaId: string;
  version: number;
  motivo: string;
  comentario: string;
}

/** El aviso recién guardado, tal como lo ve el estudiante. */
export interface AvisoGuardadoFila {
  id: string;
  motivo: Opcion;
  estado: Opcion;
  creadoEn: Date;
}

const MOTIVOS = 'SELECT codigo, nombre FROM contenido.motivo_reporte WHERE activo ORDER BY id';

// Un candado por estudiante hasta el fin de la transacción: dos envíos a la vez no pasan los límites.
const BLOQUEAR = "SELECT pg_advisory_xact_lock(hashtextextended('aviso_estudiante:' || $1, 0))";

const PENDIENTE = `
  SELECT EXISTS (
    SELECT 1 FROM app.reporte_pregunta r
      JOIN contenido.estado_reporte e ON e.id = r.estado_reporte_id
     WHERE r.estudiante_id = $1 AND r.pregunta_id = $2 AND NOT e.es_final) AS pendiente`;

const RECIENTES = `
  SELECT count(*)::int AS cantidad FROM app.reporte_pregunta
   WHERE estudiante_id = $1 AND creado_en > now() - make_interval(hours => $2)`;

const INSERTAR = `
  WITH nuevo AS (
    INSERT INTO app.reporte_pregunta (estudiante_id, pregunta_id, version_pregunta, motivo_reporte_id,
                                      comentario, estado_reporte_id, creado_en)
    SELECT $1, $2, $3, m.id, $5, e.id, now()
      FROM contenido.motivo_reporte m, contenido.estado_reporte e
     WHERE m.codigo = $4 AND m.activo AND e.codigo = 'pendiente'
    RETURNING id, motivo_reporte_id, estado_reporte_id, creado_en)
  SELECT n.id::text AS id, json_build_object('codigo', m.codigo, 'nombre', m.nombre) AS motivo,
         json_build_object('codigo', e.codigo, 'nombre', e.nombre) AS estado, n.creado_en AS "creadoEn"
    FROM nuevo n
    JOIN contenido.motivo_reporte m ON m.id = n.motivo_reporte_id
    JOIN contenido.estado_reporte e ON e.id = n.estado_reporte_id`;

export interface AvisosAppRepositorio {
  /** Los motivos activos, en el orden de la lista. */
  motivosActivos(): Promise<Opcion[]>;
  /** Reserva al estudiante hasta el fin de la transacción. */
  bloquearEstudiante(estudianteId: string, tx: Ejecutor): Promise<void>;
  /** Si el estudiante ya tiene un aviso sin cerrar de esa pregunta. */
  tienePendiente(estudianteId: string, preguntaId: string, tx: Ejecutor): Promise<boolean>;
  /** Cuántos avisos envió el estudiante en las últimas horas, según el reloj de la base. */
  contarRecientes(estudianteId: string, horas: number, tx: Ejecutor): Promise<number>;
  /** Guarda el aviso pendiente; null si el motivo no existe o no está activo. */
  insertar(aviso: AvisoNuevo, tx: Ejecutor): Promise<AvisoGuardadoFila | null>;
}

export function crearAvisosAppRepositorio(bd: Ejecutor): AvisosAppRepositorio {
  return {
    async motivosActivos() {
      return (await bd.query<Opcion>(MOTIVOS)).rows;
    },
    async bloquearEstudiante(estudianteId, tx) {
      await tx.query(BLOQUEAR, [estudianteId]);
    },
    async tienePendiente(estudianteId, preguntaId, tx) {
      const { rows } = await tx.query<{ pendiente: boolean }>(PENDIENTE, [
        estudianteId,
        preguntaId,
      ]);
      return rows[0]?.pendiente ?? false;
    },
    async contarRecientes(estudianteId, horas, tx) {
      const { rows } = await tx.query<{ cantidad: number }>(RECIENTES, [estudianteId, horas]);
      return rows[0]?.cantidad ?? 0;
    },
    async insertar({ estudianteId, preguntaId, version, motivo, comentario }, tx) {
      const { rows } = await tx.query<AvisoGuardadoFila>(INSERTAR, [
        estudianteId,
        preguntaId,
        version,
        motivo,
        comentario,
      ]);
      return rows[0] ?? null;
    },
  };
}
