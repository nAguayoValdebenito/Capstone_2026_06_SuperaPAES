// Único lugar con SQL del módulo privacidad. Consultas siempre parametrizadas ($1, $2...).
// Tablas que pertenecen a este módulo (ningún otro módulo las escribe):
//   - app.solicitud_derecho
// Las listas contenido.tipo_derecho y contenido.estado_solicitud se leen por su código, nunca por su id.
// Cada método recibe un Ejecutor opcional (tx) para sumarse a la transacción del servicio.
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

export interface PrivacidadRepositorio {
  tiposDerecho(tx?: Ejecutor): Promise<TipoDerecho[]>;
  /** Guarda la solicitud pendiente. `null` si el código del tipo no existe (no se guarda nada). */
  crearSolicitud(nueva: NuevaSolicitud, tx?: Ejecutor): Promise<FilaSolicitudPropia | null>;
  /** Las solicitudes del estudiante, de la más reciente a la más antigua. */
  solicitudesDe(estudianteId: string, tx?: Ejecutor): Promise<FilaSolicitudPropia[]>;
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
  };
}
