// Único lugar con SQL del módulo privacidad. Consultas siempre parametrizadas ($1, $2...).
// Tablas que pertenecen a este módulo (ningún otro módulo las escribe):
//   - app.solicitud_derecho
// Las listas contenido.tipo_derecho y contenido.estado_solicitud se leen por su código, nunca por su id.
// La consola lee el nombre y el correo del estudiante (app.estudiante, de cuentas) y el nombre de quien
// atendió (contenido.usuario_interno, de administracion) con uniones de solo lectura, como la
// trazabilidad de suscripciones; de una cuenta eliminada no entrega ni nombre ni correo (RNF-09).
// Cada método recibe un Ejecutor opcional (tx) para sumarse a la transacción del servicio.
import { type Pagina, paginaConTotal } from '../../db/paginacion.js';
import type { Ejecutor } from '../../db/transaccion.js';

/** Un valor de una lista de opciones (tipo de derecho o estado de la solicitud). */
export interface OpcionDeLista {
  codigo: string;
  nombre: string;
}

/** Un derecho de la Ley 21.719 con la explicación para el estudiante (A40). */
export interface TipoDerecho extends OpcionDeLista {
  descripcion: string;
}

/** Una solicitud vista por el estudiante que la presentó (HU-09). Sin datos de quién la atendió. */
export interface FilaSolicitudPropia {
  id: string;
  tipo: OpcionDeLista;
  detalle: string | null;
  estado: OpcionDeLista;
  solicitadoEn: Date;
  venceEn: Date;
  respondidoEn: Date | null;
  respuesta: string | null;
}

/** Lo que guarda HU-09.1 al recibir una solicitud: siempre queda pendiente. */
export interface NuevaSolicitud {
  estudianteId: string;
  /** Código de contenido.tipo_derecho. */
  tipo: string;
  detalle: string | null;
  solicitadoEn: Date;
  venceEn: Date;
}

/** Una solicitud en la bandeja de la consola (HU-55): con el estudiante y quién la atendió. */
export interface FilaSolicitudConsola extends FilaSolicitudPropia {
  atendidoPor: { id: string; nombre: string } | null;
  /** Solo lo necesario para atenderla. Una cuenta eliminada llega sin nombre ni correo. */
  estudiante: {
    id: string;
    nombre: string | null;
    correo: string | null;
    cuentaEliminada: boolean;
  };
}

/** Estados de contenido.estado_solicitud que filtra la bandeja. */
export type EstadoSolicitud = 'pendiente' | 'respondida' | 'rechazada';

export interface FiltroSolicitudes {
  estado: EstadoSolicitud;
  limite: number;
  desde: number;
}

/** Lo que guarda HU-55.1 al atender una solicitud. */
export interface RespuestaSolicitud {
  estado: Exclude<EstadoSolicitud, 'pendiente'>;
  respuesta: string;
  respondidoEn: Date;
  atendidoPor: string;
}

export interface PrivacidadRepositorio {
  tiposDerecho(tx?: Ejecutor): Promise<TipoDerecho[]>;
  /** Guarda la solicitud pendiente. `null` si el código del tipo no existe (no se guarda nada). */
  crearSolicitud(nueva: NuevaSolicitud, tx?: Ejecutor): Promise<FilaSolicitudPropia | null>;
  /** Las solicitudes del estudiante, de la más reciente a la más antigua. */
  solicitudesDe(estudianteId: string, tx?: Ejecutor): Promise<FilaSolicitudPropia[]>;
  /** Pendientes por fecha límite (la más próxima primero); atendidas, la última respondida primero. */
  listarSolicitudes(
    filtro: FiltroSolicitudes,
    tx?: Ejecutor,
  ): Promise<Pagina<FilaSolicitudConsola>>;
  contarPendientes(tx?: Ejecutor): Promise<number>;
  solicitud(id: string, tx?: Ejecutor): Promise<FilaSolicitudConsola | null>;
  /** Bloquea la solicitud (FOR UPDATE) y entrega su estado; `null` si no existe. */
  reservarSolicitud(
    id: string,
    tx: Ejecutor,
  ): Promise<{ estado: OpcionDeLista; final: boolean } | null>;
  responderSolicitud(id: string, respuesta: RespuestaSolicitud, tx: Ejecutor): Promise<void>;
}

const TIPOS = `
  SELECT codigo, nombre, descripcion FROM contenido.tipo_derecho ORDER BY id`;

/** Columnas de una solicitud propia, con el tipo y el estado ya unidos (alias s, td y es). */
const COLUMNAS_PROPIA = `
  s.id::text AS id, json_build_object('codigo', td.codigo, 'nombre', td.nombre) AS tipo,
  s.detalle, json_build_object('codigo', es.codigo, 'nombre', es.nombre) AS estado,
  s.solicitado_en AS "solicitadoEn", s.vence_en AS "venceEn",
  s.respondido_en AS "respondidoEn", s.respuesta`;

// Si el tipo no existe, el SELECT no entrega filas y no se inserta nada.
const CREAR = `
  WITH nueva AS (
    INSERT INTO app.solicitud_derecho
      (estudiante_id, tipo_derecho_id, detalle, estado_solicitud_id, solicitado_en, vence_en)
    SELECT $1, td.id, $3, ep.id, $4, $5
      FROM contenido.tipo_derecho td, contenido.estado_solicitud ep
     WHERE td.codigo = $2 AND ep.codigo = 'pendiente'
    RETURNING *
  )
  SELECT ${COLUMNAS_PROPIA}
    FROM nueva s
    JOIN contenido.tipo_derecho td ON td.id = s.tipo_derecho_id
    JOIN contenido.estado_solicitud es ON es.id = s.estado_solicitud_id`;

const PROPIAS = `
  SELECT ${COLUMNAS_PROPIA}
    FROM app.solicitud_derecho s
    JOIN contenido.tipo_derecho td ON td.id = s.tipo_derecho_id
    JOIN contenido.estado_solicitud es ON es.id = s.estado_solicitud_id
   WHERE s.estudiante_id = $1
   ORDER BY s.solicitado_en DESC, s.id DESC`;

/** Una solicitud de la consola: las columnas propias más el estudiante y quién la atendió. */
const DESDE_CONSOLA = `
  SELECT ${COLUMNAS_PROPIA},
         CASE WHEN u.id IS NULL THEN NULL
              ELSE json_build_object('id', u.id::text, 'nombre', u.nombre) END AS "atendidoPor",
         json_build_object(
           'id', e.id::text,
           'nombre', CASE WHEN e.eliminado_en IS NULL THEN e.nombre END,
           'correo', CASE WHEN e.eliminado_en IS NULL THEN e.correo END,
           'cuentaEliminada', e.eliminado_en IS NOT NULL) AS estudiante
    FROM app.solicitud_derecho s
    JOIN contenido.tipo_derecho td ON td.id = s.tipo_derecho_id
    JOIN contenido.estado_solicitud es ON es.id = s.estado_solicitud_id
    JOIN app.estudiante e ON e.id = s.estudiante_id
    LEFT JOIN contenido.usuario_interno u ON u.id = s.atendido_por`;

// El orden depende del estado: las pendientes, por fecha límite (usa ix_solicitud_pendientes).
const LISTA = `
  ${DESDE_CONSOLA}
   WHERE es.codigo = $1
   ORDER BY CASE WHEN $1 = 'pendiente' THEN s.vence_en END ASC,
            s.respondido_en DESC, s.id
   LIMIT $2 OFFSET $3`;
const LISTA_PAGINADA = LISTA.replace(
  ' AS estudiante',
  ' AS estudiante, count(*) OVER ()::int AS total',
);
const CONTEO = `
  SELECT count(*)::int AS total
    FROM app.solicitud_derecho s
    JOIN contenido.estado_solicitud es ON es.id = s.estado_solicitud_id
   WHERE es.codigo = $1`;

const UNA = `${DESDE_CONSOLA} WHERE s.id = $1`;

const RESERVAR = `
  SELECT json_build_object('codigo', es.codigo, 'nombre', es.nombre) AS estado, es.es_final AS final
    FROM app.solicitud_derecho s
    JOIN contenido.estado_solicitud es ON es.id = s.estado_solicitud_id
   WHERE s.id = $1
     FOR UPDATE OF s`;

const RESPONDER = `
  UPDATE app.solicitud_derecho s
     SET estado_solicitud_id = es.id, respuesta = $3, respondido_en = $4, atendido_por = $5
    FROM contenido.estado_solicitud es
   WHERE s.id = $1 AND es.codigo = $2`;

/** Consultas de la bandeja de la consola (HU-55.1). */
function consultasConsola(bd: Ejecutor) {
  return {
    async listarSolicitudes({ estado, limite, desde }: FiltroSolicitudes, tx = bd) {
      return paginaConTotal<FilaSolicitudConsola>(
        tx,
        [LISTA_PAGINADA, CONTEO],
        [estado],
        [limite, desde],
      );
    },
    async contarPendientes(tx = bd) {
      const { rows } = await tx.query<{ total: number }>(CONTEO, ['pendiente']);
      return rows[0]?.total ?? 0;
    },
    async solicitud(id: string, tx = bd) {
      return (await tx.query<FilaSolicitudConsola>(UNA, [id])).rows[0] ?? null;
    },
    async reservarSolicitud(id: string, tx: Ejecutor) {
      const { rows } = await tx.query<{ estado: OpcionDeLista; final: boolean }>(RESERVAR, [id]);
      return rows[0] ?? null;
    },
    async responderSolicitud(id: string, r: RespuestaSolicitud, tx: Ejecutor) {
      await tx.query(RESPONDER, [id, r.estado, r.respuesta, r.respondidoEn, r.atendidoPor]);
    },
  };
}

export function crearPrivacidadRepositorio(bd: Ejecutor): PrivacidadRepositorio {
  return {
    async tiposDerecho(tx = bd) {
      return (await tx.query<TipoDerecho>(TIPOS)).rows;
    },
    async crearSolicitud(nueva, tx = bd) {
      const { rows } = await tx.query<FilaSolicitudPropia>(CREAR, [
        nueva.estudianteId,
        nueva.tipo,
        nueva.detalle,
        nueva.solicitadoEn,
        nueva.venceEn,
      ]);
      return rows[0] ?? null;
    },
    async solicitudesDe(estudianteId, tx = bd) {
      return (await tx.query<FilaSolicitudPropia>(PROPIAS, [estudianteId])).rows;
    },
    ...consultasConsola(bd),
  };
}
