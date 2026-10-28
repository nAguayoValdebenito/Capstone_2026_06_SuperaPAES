// Puntajes PAES declarados y su permiso (HU-41.1, RN-16): app.puntaje_paes y los consentimientos del
// permiso de puntajes en app.consentimiento. El tipo del documento se lee de contenido como lo hace el
// disparador app.tg_puntaje_paes. Las horas llegan del reloj del servicio.
import type { Ejecutor } from '../../db/transaccion.js';

/** El permiso de puntajes sin revocar del estudiante. */
export interface PermisoPuntajes {
  id: string;
  aceptadoEn: Date;
}

export interface FilaPuntaje {
  id: string;
  pruebaId: number;
  anioAdmision: number;
  puntaje: number;
  creadoEn: Date;
}

export interface NuevoPuntaje {
  estudianteId: string;
  pruebaId: number;
  consentimientoId: string;
  anioAdmision: number;
  puntaje: number;
  creadoEn: Date;
}

/** Consentimientos del estudiante que son del permiso de puntajes (cualquier versión). */
const DEL_PERMISO = `
  c.estudiante_id = $1
  AND c.documento_legal_id IN (
    SELECT d.id FROM contenido.documento_legal d
      JOIN contenido.tipo_documento_legal t ON t.id = d.tipo_documento_legal_id
     WHERE t.codigo = 'puntajes')`;

const PERMISO_VIGENTE = `
  SELECT c.id::text AS id, c.aceptado_en AS "aceptadoEn"
    FROM app.consentimiento c
   WHERE ${DEL_PERMISO} AND c.revocado_en IS NULL
   ORDER BY c.aceptado_en DESC
   LIMIT 1`;

/** Si ya lo dio en esta versión, no cambia nada (ux_consentimiento_vigente). */
const OTORGAR = `
  INSERT INTO app.consentimiento (estudiante_id, documento_legal_id, aceptado_en)
  VALUES ($1, $2, $3)
  ON CONFLICT (estudiante_id, documento_legal_id) WHERE revocado_en IS NULL DO NOTHING`;

const REVOCAR = `
  UPDATE app.consentimiento c SET revocado_en = $2
   WHERE ${DEL_PERMISO} AND c.revocado_en IS NULL`;

const PUNTAJES = `
  SELECT id::text AS id, prueba_id AS "pruebaId", anio_admision AS "anioAdmision", puntaje,
         creado_en AS "creadoEn"
    FROM app.puntaje_paes
   WHERE estudiante_id = $1
   ORDER BY anio_admision DESC, prueba_id`;

/** Un puntaje por prueba y año: cargarlo de nuevo lo corrige. */
const GUARDAR = `
  INSERT INTO app.puntaje_paes
    (estudiante_id, prueba_id, consentimiento_id, anio_admision, puntaje, creado_en)
  VALUES ($1, $2, $3, $4, $5, $6)
  ON CONFLICT (estudiante_id, prueba_id, anio_admision) DO UPDATE
     SET puntaje = EXCLUDED.puntaje, consentimiento_id = EXCLUDED.consentimiento_id,
         creado_en = EXCLUDED.creado_en`;

/** El permiso de puntajes: leerlo, darlo y retirarlo. */
function crearPermisoRepositorio(bd: Ejecutor) {
  return {
    /**
     * Con `bloquear`, lo toma (FOR SHARE) hasta el fin de la transacción: retirar el permiso espera a
     * que termine de guardarse el puntaje, y después lo borra.
     */
    async permisoVigente(
      estudianteId: string,
      bloquear: boolean,
      tx: Ejecutor = bd,
    ): Promise<PermisoPuntajes | null> {
      const consulta = bloquear ? `${PERMISO_VIGENTE} FOR SHARE OF c` : PERMISO_VIGENTE;
      const { rows } = await tx.query<PermisoPuntajes>(consulta, [estudianteId]);
      return rows[0] ?? null;
    },

    async otorgarPermiso(
      estudianteId: string,
      documentoId: number,
      aceptadoEn: Date,
      tx: Ejecutor = bd,
    ): Promise<void> {
      await tx.query(OTORGAR, [estudianteId, documentoId, aceptadoEn]);
    },

    /** Primero revoca y después borra: así espera a un puntaje que se esté guardando con el permiso. */
    async revocarPermisoYBorrar(
      estudianteId: string,
      ahora: Date,
      tx: Ejecutor = bd,
    ): Promise<void> {
      await tx.query(REVOCAR, [estudianteId, ahora]);
      await tx.query('DELETE FROM app.puntaje_paes WHERE estudiante_id = $1', [estudianteId]);
    },
  };
}

export function crearPuntajesRepositorio(bd: Ejecutor) {
  return {
    ...crearPermisoRepositorio(bd),

    async puntajes(estudianteId: string, tx: Ejecutor = bd): Promise<FilaPuntaje[]> {
      const { rows } = await tx.query<FilaPuntaje>(PUNTAJES, [estudianteId]);
      return rows;
    },

    async guardarPuntaje(datos: NuevoPuntaje, tx: Ejecutor = bd): Promise<void> {
      const { estudianteId, pruebaId, consentimientoId, anioAdmision, puntaje, creadoEn } = datos;
      await tx.query(GUARDAR, [
        estudianteId,
        pruebaId,
        consentimientoId,
        anioAdmision,
        puntaje,
        creadoEn,
      ]);
    },

    /** false si no existe o es de otro estudiante. */
    async borrarPuntaje(estudianteId: string, id: number, tx: Ejecutor = bd): Promise<boolean> {
      const { rowCount } = await tx.query(
        'DELETE FROM app.puntaje_paes WHERE id = $1 AND estudiante_id = $2',
        [id, estudianteId],
      );
      return (rowCount ?? 0) > 0;
    },

    async pruebaActiva(pruebaId: number, tx: Ejecutor = bd): Promise<boolean> {
      const { rows } = await tx.query('SELECT 1 FROM contenido.prueba WHERE id = $1 AND activa', [
        pruebaId,
      ]);
      return rows.length > 0;
    },
  };
}

export type PuntajesRepositorio = ReturnType<typeof crearPuntajesRepositorio>;
